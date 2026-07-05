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
- Ao validar mudanças, rodar só `bun run test:unit` — nunca `test:integration` (lento, sobe app+Redis) a menos que o usuário peça explicitamente
- Ao criar um módulo novo, rodar `bun run build` e `bun run test:unit` para validar que não há import quebrado e que os testes passam

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
Módulos: auth, users, companies, dids, extensions, queues, queue-members, trunks, outbound-routes, inbound-routes, time-groups, time-conditions, cdr, announcements, ivr, request-templates, audios

## Repositórios Asterisk (`src/asterisk/`)
Cada repositório escreve direto nas tabelas realtime do Asterisk via Prisma:
- `sip.repository.ts` → `sip_peers`
- `pjsip.repository.ts` → `ps_endpoints`, `ps_auths`, `ps_aors`, `ps_identifies`, `ps_registrations`
- `queue.repository.ts` → `queues`, `queue_members`
- `dialplan.repository.ts` → `extensions` (dialplan realtime)
- `timecondition.repository.ts` → dialplan no contexto fixo `timeconditions` (exten `tc-<tcId>`/`tc-<tcId>-matched`)
- `inboundroute.repository.ts` → dialplan para rotas de entrada
- `announcement.repository.ts` → dialplan no contexto fixo `announcements` (exten `ann-<id>`, Playback+Hangup)
- `ivr.repository.ts` → dialplan no contexto fixo `ivrs` (exten `ivr-<id>`), state machine de prioridades numéricas pra Read()+GotoIf
- `audio.repository.ts` → só paths de áudio (`/var/lib/asterisk/sounds/<asteriskId>/<audioId>.wav`) — único lugar que grava arquivo físico; Announcement/IvrMenu só referenciam um `Audio.id`, sem dialplan próprio

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

## Timezone (`src/utils/timezone.ts`)

Storage é sempre UTC (`@db.Timestamptz`) exceto CDR (ver abaixo). Exibição na API é convertida por empresa.

- `Company.timezone` — string IANA, default `"America/Sao_Paulo"`, só define fuso de exibição (storage continua UTC)
- Hook `preSerialization` em `app.ts`: `collectCompanyIds(payload)` varre a resposta, resolve timezone de cada `companyId` via `getCompanyById` (cacheado), e `formatDatesDeep(payload, env.TZ, tzByCompanyId)` converte todo `Date` pra ISO com offset fixo (`toTzISOString`) — usa `env.TZ` como fallback quando não há empresa no contexto
- Um registro que carrega seu próprio campo `timezone` (ex: a própria Company) vira fonte pra si e pros filhos aninhados, sem precisar de lookup

**CDR é exceção:** `cdr.start/answer/endtime` são `TIMESTAMP` **sem timezone** — o Asterisk grava a hora LOCAL do SO (`America/Sao_Paulo`, setado em `setups/install-asterisk.sh`), não UTC. O driver pg lê esses dígitos como se fossem UTC, então tratar como instante UTC real (como o resto do schema) causa erro de 3h na exibição.
- Filtro por `startDate`/`endDate` (CDR) usa data solta `YYYY-MM-DD`, sem offset — os dígitos já batem 1:1 com o storage naive local, então dá pra construir `new Date(`${data}T00:00:00.000Z`)`/`T23:59:59.999Z` direto, sem conversão de tz
- `formatNaiveLocalISOString(date, tz)` — usar pra formatar `startTime`/`answerTime`/`endTime` na saída do service (retorna string, não `Date`, então o hook genérico não reconverte)
- Nunca aplicar `toTzISOString`/`formatDatesDeep` diretamente nesses três campos do CDR

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
Vars: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `JWT_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `REDIS_URL`, `CORS_ORIGIN`, `RATE_LIMIT_MAX` (1000), `RATE_LIMIT_WINDOW` ("1 second"), `PORT` (3333), `HOST`, `LOG_LEVEL`, `LOG_ENABLED`, `TZ` (America/Sao_Paulo — fallback de exibição, ver seção Timezone)

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
- Time Conditions: ao criar/atualizar/deletar, regenera dialplan no contexto fixo compartilhado `timeconditions` (exten `tc-<tcId>`/`tc-<tcId>-matched`) via `GotoIfTime` — OR lógico entre todos os ranges de todos os TGs vinculados. Contexto dinâmico por entidade (`tc-<id>`) não é usado — mesma limitação de `ramais-<asteriskId>` (ver seção acima): Asterisk só resolve realtime pra contextos declarados estaticamente em `extensions.conf`
- **Route destination** (`src/schemas/route-destination.schema.ts`) — shape compartilhado por Inbound Routes (`destination`), Time Conditions (`trueRoute`/`falseRoute`), Queues (`postQueueDestination`), IVR Menus (`invalidDestination`/`timeoutDestination`/`longDestination`/opção de dígito) e Request Templates (`onSuccess`/`onError`): `{ type: "extension"|"queue"|"voicemail"|"timecondition"|"announcement"|"ivr"|"request"|"hangup", id?: cuid2 } | null` (`id` obrigatório exceto hangup; `null`/omitido = hangup). Validação de existência/posse centralizada em `validateRouteDestination()` (`src/schemas/route-destination.validate.ts`), usada por todos os services acima — não duplicar esse switch-case ao adicionar novo tipo
- Áudio (`Audio` model, módulo `audios`) é desacoplado de quem o usa: upload é feito uma vez via `POST /audios` (multipart, por empresa) e o `audioId` retornado é referenciado por `Announcement.audioId`/`IvrMenu.audioId` — o mesmo Audio pode ser reaproveitado por mais de um registro. Áudio é convertido automaticamente pra WAV PCM 16-bit mono 8kHz (slin) via `sox` — qualidade sem perdas, compatível com os codecs das trunks (ulaw/alaw) sem resample na chamada. Único arquivo físico por Audio, em `/var/lib/asterisk/sounds/<asteriskId>/<audioId>.wav`
  - `DELETE /audios/:id` desvincula automaticamente (`SetNull`) qualquer Announcement/IvrMenu que o referencie, removendo o dialplan deles na mesma operação (senão ficaria um Playback/Read apontando pro arquivo apagado) — não bloqueia com 409
  - Announcement/IvrMenu usados como destino de rota (`type: "announcement"|"ivr"`) exigem `audioId` vinculado (`hasAudio: true`), senão 400 em `validateRouteDestination`
- `context` de Extension: default `"ramais"`, compartilhado entre todas as empresas — isolamento entre empresas é feito via sufixo `asteriskId` no `number`/`exten` (ex: `2002_a9e2463c8f`), não por contexto Asterisk separado. Contextos dinâmicos por empresa (`ramais-<asteriskId>`) **não funcionam** nesse setup: o Asterisk só resolve realtime dialplan pra contextos declarados estaticamente em `extensions.conf` com `switch => Realtime/<contexto>@extensions` — tentativa de escopar por empresa quebra a resolução de chamadas. Isolamento de verdade entre empresas exigiria uma reformulação maior (contexto único + AGI/`func_odbc` decidindo rota em tempo de chamada, ao estilo MagnusBilling) — não implementado

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

**Queues** — `{ name(alphanum/dash/_), number(^\d+$), companyId, strategy?, musicOnHold?, timeout?, retry?, maxLen?, wrapupTime?, announce?, announceFrequency?, joinEmpty?, leaveWhenEmpty?, weight? }`
- `number` obrigatório no create, único por empresa (`UNIQUE(number, companyId)`) — usado como destino de inbound routes/time conditions (`Goto(queues-app,<asteriskId>-<number>,1)`)
- strategies: `ringall|leastrecent|fewestcalls|random|rrmemory|linear|wrandom`
- Member add: `{ extensionId, penalty?(0-100), paused? }`; update: `{ penalty?, paused?, pauseReason? }`
- `pauseReason`: persiste em `queue_members.reason_paused` (realtime) só enquanto `paused=true`; some ao despausar

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
- `destination`: route destination compartilhado (ver seção "Route destination" acima)

**Time Groups** — `{ id, name, companyId, ranges[{startTime(HH:MM), endTime(HH:MM), weekdays(mon-sun[]), monthdays?, months?}], createdAt, updatedAt }`
- Update: `{ name?, ranges? }` — ranges substitui lista completa

**Time Conditions** — `{ id, name, companyId, trueRoute, falseRoute, timeGroups[{timeGroup:{id,name}}], createdAt, updatedAt }`
- Create: `{ name, companyId, trueRoute?, falseRoute?, groupIds?[] }`
- Update: `{ name?, trueRoute?, falseRoute? }` (min 1)
- Route format: route destination compartilhado (ver seção "Route destination" acima)

**Audios** — `{ id, name, companyId, createdAt, updatedAt }`
- Create: `POST /audios` — multipart/form-data com campos de texto `name`+`companyId` **antes** do arquivo, até 15MB. Converte pra WAV slin 8kHz mono 16-bit via `sox` → `{ audioId }`
- Update: `PATCH /:id` — `{ name }` (só rename)
- Delete: `DELETE /:id` — remove registro e `.wav`; desvincula (não bloqueia) Announcement/IvrMenu que o referenciem, removendo o dialplan deles
- `UNIQUE(name, companyId)`
- Delete Company → cascade Audios (dialplan dos consumidores limpo antes; pasta `/var/lib/asterisk/sounds/<asteriskId>/` inteira removida)

**Announcements** — `{ id, name, companyId, audioId, hasAudio, createdAt, updatedAt }`
- Create: `{ name, companyId, audioId? }` → `{ announcementId }` (com `audioId` já sai com dialplan; sem ele fica pendente)
- Update: `{ name?, audioId? }` (min 1; `audioId: null` desvincula e remove o dialplan)
- Delete: remove registro e dialplan (`announcements`/`ann-<id>`) — não mexe no Audio vinculado
- Delete Company → cascade Announcements (dialplan) + cascade Audios (ver seção Audios)

**IVR Menus** (`/ivr-menus`) — `{ id, name, companyId, audioId, hasAudio, maxDigits, digitTimeout, invalidRetries, invalidDestination, timeoutRetries, timeoutDestination, longDestination, options[{id,digit,destination}], createdAt, updatedAt }`
- Create: `{ name, companyId, audioId?, maxDigits?, digitTimeout?, invalidRetries?, invalidDestination?, timeoutRetries?, timeoutDestination?, longDestination?, options?[{digit, destination?}] }` → `{ ivrMenuId }`
- Update: `{ name?, audioId?, ...resto opcional, options? }` (min 1; `options` substitui lista completa; `audioId: null` desvincula)
- `maxDigits > 1` permite sequência longa (ex: CPF) tratada via `longDestination` quando não bate com nenhuma opção de 1 dígito
- Delete: remove registro e dialplan (`ivrs`/`ivr-<id>`) — não mexe no Audio vinculado
- Delete Company → cascade IVR Menus (dialplan) + cascade Audios (ver seção Audios)

**CDR** — `GET /cdr` — `{ records[], total, limit }`
- Query obrigatória: `companyId`; opcionais: `startDate`/`endDate` (`YYYY-MM-DD`, cobrem o dia inteiro 00:00:00–23:59:59.999, sem offset/hora), `src`, `dst`, `callStatus` (enum disposition), `limit`(max 200), `order`(asc|desc, default desc — aplica em startTime+id)
- Sem paginação por cursor — só `limit`/`order`, sem navegação por página
- Isolamento por empresa via `accountcode = Company.asteriskId` (não por FK)
- `callStatus` na query mapeia pra coluna `disposition` no banco; na resposta o campo também sai como `callStatus` (não `disposition`) — nome escolhido por ser mais intuitivo pro consumidor da API
- `startTime`/`answerTime`/`endTime`: ver seção Timezone — são hora local naive do CDR nativo do Asterisk, formatados na saída via `formatNaiveLocalISOString`, nunca como UTC direto. Filtro por data não precisa de conversão de tz: os dígitos de `startDate`/`endDate` já batem 1:1 com o storage naive local
