# Sofon PABX — Backend

## Stack
- Bun + Fastify + Prisma (PostgreSQL) + Redis (JTI) + node-cache (entity cache)
- Validação: Zod via `fastify-type-provider-zod` (`validatorCompiler` + `serializerCompiler`)
- JWT: HS256 com `jsonwebtoken` (JWT_SECRET / REFRESH_SECRET) — access 15min, refresh 7d
- Swagger: `@fastify/swagger` + Scalar UI em `/docs`
- Testes: `bun run test` | `bun run test:unit` | `bun run test:integration`

## Convenções
- Sem comentários óbvios; sem error handling para casos impossíveis
- Validação só em boundaries; Zod para body/params
- Nunca rodar DELETE/migrate/drop sem confirmação explícita do usuário
- Nunca editar schema.prisma e mandar rodar migration — orientar o usuário a rodar ele mesmo

---

## Estrutura de módulo
```
src/modules/<name>/
  <name>.routes.ts      # Fastify plugin, schema Zod inline, onRequest hooks
  <name>.controller.ts  # chama service, retorna reply.send({ success: true, ... })
  <name>.service.ts     # lógica de negócio, usa prisma, lança AppError
  schemas/<name>.schema.ts  # Zod schemas de input/output + response types
  cache/<name>.cache.ts     # wrapper de CacheManager para o módulo
```
Módulos: auth, users, companies, dids, extensions, queues, queue-members, trunks, outbound-routes, inbound-routes, time-groups, time-conditions

## Repositórios Asterisk (`src/asterisk/`)
Cada repositório escreve direto nas tabelas realtime do Asterisk via Prisma:
- `sip.repository.ts` → `sip_peers`
- `pjsip.repository.ts` → `ps_endpoints`, `ps_auths`, `ps_aors`, `ps_identifies`, `ps_registrations`
- `queue.repository.ts` → `queues`, `queue_members`
- `dialplan.repository.ts` → `extensions` (dialplan realtime)
- `timecondition.repository.ts` → dialplan para contextos `tc-<id>`
- `inboundroute.repository.ts` → dialplan para rotas de entrada

---

## Respostas e erros (`src/schemas/responses.ts`)

```ts
ok(shape)   // → { success: true, ...shape }
deleted     // → ok({ message: z.string() })
errors      // { 400, 401, 403, 404, 409, 422 } → { success: false, message }
cuidParam   // z.string().regex(/^[0-9a-z]{24,}$/) — rejeita strings curtas
timestamp   // z.union([z.date(), z.string()]) — aceita Date (Prisma) e string (cache)
```

Erros no controller: `handleError(reply, error, req)` de `src/utils/errors/handler.error.ts`
- `ZodError` → 400 com `errors: issue[]`
- `AppError` → statusCode da instância
- `Error` genérico → 500 + log

Lançar erros: `throw new AppError('message', statusCode)` de `src/utils/errors/app.error.ts`

---

## Auth & middleware (`src/middleware/`)

**`authMiddleware`** — verifica Bearer JWT, checa JTI no Redis, popula `req.user = { id, role }`

**`scopeMiddleware`** — roda após auth, popula `req.scope`:
```ts
req.scope = {
  isAdmin: boolean,
  companyIds: string[] | null,  // null se admin
  canAccess(companyId): boolean,
  assertAccess(companyId): void  // lança AppError 403 se sem acesso
}
```

**Composições prontas:**
```ts
protectedRoute = [authMiddleware, scopeMiddleware]  // rotas autenticadas
requireAdmin    // lança 403 se !scope.isAdmin
```

**Uso em rota:**
```ts
onRequest: protectedRoute
onRequest: [...protectedRoute, requireAdmin]
```

**Roles:** `admin` | `reseller` | `user`

---

## Cache

**Redis** (`src/config/redis.ts`) — só para JTI. `jtiManager.add/exists/revoke/revokeByUserId`
- Chave: `jti:<uuid>`, valor: userId, TTL: 15min

**node-cache** (`src/config/cache.ts`) — cache de entidades em memória, `CacheManager` singleton
- `cacheManager.get/set/invalidate(namespace)/invalidateByKey(key)/clear()`
- Cada módulo tem `src/modules/<name>/cache/<name>.cache.ts` com métodos estáticos tipados

---

## Testes

**Unit (`*.service.test.ts`):**
```ts
import { mock } from 'bun:test'
// mock.module() ANTES dos imports do módulo testado
const { createPrismaMock, clearPrismaMock } = await import('src/test/mocks/prisma.mock')
const db = createPrismaMock()
// clearPrismaMock(db) no beforeEach/afterEach
```
`createPrismaMock()` — retorna mock de todos os models Prisma + tabelas Asterisk realtime + `$transaction`
`clearPrismaMock(db)` — `mockReset()` em tudo + restaura `$transaction`

**Integration (`*.routes.test.ts`):**
```ts
import { buildApp } from 'src/test/build-app'
// buildApp() sobe Fastify completo com Redis + todos os módulos
// beforeAll/afterAll timeout 30s
// dados únicos: sufixo Date.now()
```

**Proibido:** `expect(...).resolves.not.toThrow()` — usar `await service.method()` + `toHaveBeenCalled()`

---

## Config (`src/config/env.ts`)
Vars: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `JWT_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `REDIS_URL`, `CORS_ORIGIN`, `RATE_LIMIT_MAX` (1000), `RATE_LIMIT_WINDOW` ("1 second"), `PORT` (3333), `HOST`, `LOG_LEVEL`, `LOG_ENABLED`

---

## API — regras de negócio críticas

- `/auth/register` só funciona quando `COUNT(users) === 0`; criado sempre como `admin`
- JTI: access token tem JTI armazenado no Redis — logout deleta o JTI (`jtiManager.revoke`)
- `webhookSlug` em User: UUID gerado no create, nunca alterável
- `extensionId` em User: vincula ao ramal — usado para checar pause/unpause em filas (não-admin só age no próprio ramal)
- DIDs: `UNIQUE(number, companyId)` — mesmo número pode existir em empresas diferentes
- Delete Company → cascade DIDs; Delete OutboundRoute → cascade OutboundDialPatterns
- `position` em OutboundRoute: menor = maior prioridade
- `PUT /outbound-routes/:id/trunks`: substitui lista completa (não aditivo)
- `allowOutbound` em Extension: persiste `ALLOW_OUTBOUND=1/0` em `sip_peers.setvar` / `ps_endpoints.setvar`
- Time Conditions: ao criar/atualizar/deletar, regenera contexto `tc-<id>` no dialplan Asterisk via `GotoIfTime` — OR lógico entre todos os ranges de todos os TGs vinculados

## API — schemas de input/output por módulo

**Auth**
- Register: `{ name, username(email), password(min6) }` → 201
- Login: `{ username, password }` → `{ accessToken, refreshToken }`
- Refresh: `{ refreshToken }` → `{ accessToken }`
- Logout: → 204

**Users** — `{ id, name, username, role, status, extensionId?, webhookSlug(uuid), createdAt, updatedAt }`
- Create: `{ name, username, password }` → `{ userId }`
- Update: `{ name?, username?, password?, extensionId? }` (min 1)

**Companies** — `{ id, name, doc?, metadata(json), createdAt, updatedAt }`
- Create: `{ name, doc?, metadata?, userId? }`
- Update: `{ name?, doc?, metadata? }` (min 1)

**DIDs** — `{ id, number, companyId, company, createdAt, updatedAt }`
- Create: `{ number(^\d+$), companyId }`; Update: `{ number? }`

**Extensions** — discriminatedUnion por `type: "sip"|"pjsip"`
- Create sip: `{ alias(2-6 dígitos), name, companyId, context?, allowOutbound?, ...sipFields }`
- Create pjsip: `{ alias, name, companyId, context?, allowOutbound?, namedcallgroup?, namedpickupgroup?, ...pjsipFields }`
- Batch: `{ extensions: CreateExtension[] }` (max 50, sem alias duplicado por empresa)
- Update: `{ name?, allowOutbound? }`; `PATCH /:id/password` reseta senha

**Queues** — `{ name(alphanum/dash/_), number?, companyId, strategy?, musicOnHold?, timeout?, retry?, maxLen?, wrapupTime?, announce?, announceFrequency?, joinEmpty?, leaveWhenEmpty?, weight? }`
- strategies: `ringall|leastrecent|fewestcalls|random|rrmemory|linear|wrandom`
- Member add: `{ extensionId, penalty?(0-100), paused? }`; update: `{ penalty?, paused? }`

**Trunks** — discriminatedUnion por `registrationMode: "outbound"|"inbound"`
- outbound: `{ name, companyId, type(sip|pjsip), host, username, password, context?, codecs? }`
- inbound: todos opcionais exceto name/companyId/type
- Update: `{ host?, username?, password?, context?, codecs? }`

**Outbound Routes** — `{ id, name, companyId, position, patterns[], trunks[], extensions[], createdAt, updatedAt }`
- Create: `{ name, companyId, position?, patterns?[{pattern, prefix?, prepend?}], trunkIds?[] }`
- Update: `{ name?, position? }`; patterns CRUD; trunks: `{ trunkIds[] }` (substitui tudo); extensions: `{ extensionId }`

**Inbound Routes** — `{ id, name, companyId, didId, trunkId, did{id,number}, trunk{id,name}, destination, createdAt, updatedAt }`
- Create: `{ name, companyId, didId, trunkId, destination? }`
- Update: `{ name?, destination? }` (min 1)
- `destination`: `{ type: "extension"|"queue"|"voicemail"|"timecondition"|"hangup", id?: cuid2 } | null`

**Time Groups** — `{ id, name, companyId, ranges[{startTime(HH:MM), endTime(HH:MM), weekdays(mon-sun[]), monthdays?, months?}], createdAt, updatedAt }`
- Update: `{ name?, ranges? }` — ranges substitui lista completa

**Time Conditions** — `{ id, name, companyId, trueRoute, falseRoute, timeGroups[{timeGroup:{id,name}}], createdAt, updatedAt }`
- Create: `{ name, companyId, trueRoute?, falseRoute?, groupIds?[] }`
- Update: `{ name?, trueRoute?, falseRoute? }` (min 1)
- Route format: `{ type: "extension"|"queue"|"voicemail"|"timecondition"|"hangup", id?: cuid2 } | null` (null = Hangup)
