# Sofon PABX - Backend

## Stack
- Bun + Fastify + Prisma (PostgreSQL) + Redis (JTI) + node-cache (entity cache)
- Validação: Zod via `fastify-type-provider-zod` (`validatorCompiler` + `serializerCompiler`)
- JWT: HS256 com `jsonwebtoken` (JWT_SECRET / REFRESH_SECRET) - access 15min, refresh 7d
- Swagger: `@fastify/swagger` + Scalar UI em `/docs`
- Testes: `bun run test` | `bun run test:unit` | `bun run test:integration`

## Convenções
- Sem comentários óbvios; sem error handling para casos impossíveis
- Validação só em boundaries; Zod para body/params
- Nunca rodar DELETE/migrate/drop sem confirmação explícita do usuário
- Nunca editar schema.prisma e mandar rodar migration - orientar o usuário a rodar ele mesmo
- Ao validar mudanças, rodar só `bun run test:unit` - nunca `test:integration` (lento, sobe app+Redis) a menos que o usuário peça explicitamente
- Ao criar um módulo novo, rodar `bun run build` e `bun run test:unit` para validar que não há import quebrado e que os testes passam. `bun run build` é só o bundler (`bun build`) - não faz type-check; pra validar tipos (ex: exaustividade de switch num discriminated union) rodar `bunx tsc --noEmit`
- Documentação de bug/incidente resolvido (causa raiz, como foi diagnosticado, jornada de debug) vai em `docs/runbooks/<slug>.md`, nunca aqui - CLAUDE.md é só fato do estado atual, sempre carregado; o fato permanente resultante do incidente (ex: uma variável de env nova, uma rede extra necessária) fica documentado aqui de forma curta, com link pro runbook pra quem precisar do "porquê"

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
Módulos: auth, users, companies, dids, extensions, queues, queue-members, trunks, outbound-routes, inbound-routes, time-groups, time-conditions, holiday-groups, cdr, announcements, ivr, request-templates, audios, variables, variable-conditions, callcenter (agents, routing-rules, ratings, affinity - ver seção "Callcenter (Queue Engine)")

## Repositórios Asterisk (`src/asterisk/`)
Cada repositório escreve direto nas tabelas realtime do Asterisk via Prisma:
- `sip.repository.ts` → `sip_peers`
- `pjsip.repository.ts` → `ps_endpoints`, `ps_auths`, `ps_aors`, `ps_identifies`, `ps_registrations`
- `queue.repository.ts` → `queues`, `queue_members` + dialplan estático do contexto `queues-app` (ver "Callcenter (Queue Engine)")
- `callcenter-survey.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `callcenter-surveys`, exten `survey-<queueId>`, `Read()` de 1 dígito (1-5) - pesquisa de satisfação pós-atendimento
- `dialplan.repository.ts` → tabela `extensions` via Realtime - contextos `ramais` e `from-trunk-routed` (alta escrita; permanecem no banco)
- `inboundroute.repository.ts` → tabela `extensions` via Realtime - contexto `from-trunk-routed`, exten `<did>_<trunkId>`. Priority 1 sempre `Set(ROUTING_TRUNK_ID=<trunkId>)` - variável de canal lida pelo AGI `queue-route` pra casar `RoutingRule.conditions.trunkId`, sobrevive a qualquer `Goto` intermediário (timecondition/holiday/ivr) até a chamada cair numa fila
- `timecondition.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `timeconditions`, exten `tc-<tcId>`/`tc-<tcId>-matched`, `GotoIfTime` em OR lógico sobre todos os ranges dos TGs vinculados
- `announcement.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `announcements`, exten `ann-<id>`, `Playback` + destino final
- `ivr.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `ivrs`, exten `ivr-<id>`, state machine `Read()+GotoIf` com prioridades numéricas
- `holidaygroup.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `holidays`, exten `hol-<id>`, `GotoIfTime` por datas (month/day)
- `audio.repository.ts` → só paths de áudio (`/var/lib/asterisk/sounds/<asteriskId>/<audioId>.wav`) - único lugar que grava arquivo físico; Announcement/IvrMenu só referenciam um `Audio.id`, sem dialplan próprio
- `variable.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `variables`, exten `var-<id>`, `Set()` de 1+ variáveis de canal seguido do destino configurado
- `variablecondition.repository.ts` → arquivo estático via `dialplan-file.repository.ts` - contexto `variable-conditions`, exten `varcond-<id>`, `GotoIf` por regra (preenchida/tamanho/igualdade/regex/numérica) combinadas em AND ou OR, trueRoute/falseRoute
- `dialplan-file.repository.ts` → infraestrutura de materialização: gera `/etc/asterisk/dialplan-extra/<context>/<asteriskId>.conf` a partir de linhas `DialplanRow[]`. Escrita atômica via `rename()` no mesmo filesystem. Lock por chave `<context>/<asteriskId>` serializa CRUDs simultâneos. Após cada escrita chama `asterisk -rx 'dialplan reload'`. Contextos gerenciados: `timeconditions`, `announcements`, `ivrs`, `queues-app`, `request-templates`, `holidays`, `callcenter-surveys`, `variables`, `variable-conditions` - zero query ao banco em tempo de chamada para esses contextos.

---

## Respostas e erros (`src/schemas/responses.ts`)

```ts
ok(shape)   // → { success: true, ...shape }
deleted     // → ok({ message: z.string() })
errors      // { 400, 401, 403, 404, 409, 422 } → { success: false, message }
cuidParam   // z.string().regex(/^[0-9a-z]{24,}$/) - rejeita strings curtas
timestamp   // z.union([z.date(), z.string()]) - aceita Date (Prisma) e string (cache)
```

Erros no controller: `handleError(reply, error, req)` de `src/utils/errors/handler.error.ts`
- `ZodError` → 400 com `errors: issue[]`
- `AppError` → statusCode da instância
- `Error` genérico → 500 + log

Lançar erros: `throw new AppError('message', statusCode)` de `src/utils/errors/app.error.ts`

---

## Auth & middleware (`src/middleware/`)

**`authMiddleware`** - verifica Bearer JWT, checa JTI no Redis, popula `req.user = { id, role }`

**`scopeMiddleware`** - roda após auth, popula `req.scope`:
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
onRequest: [...protectedRoute, requirePermission('<resource>', 'view'|'manage')]
```

**Roles:** `admin` | `reseller` | `user`

**Permissões granulares por usuário** (`src/middleware/permission.middleware.ts` + `src/utils/auth/permissions.ts`): só se aplica a `role === "user"`; admin/reseller sempre bypassam (acesso irrestrito, sem mudança de comportamento).
- `User.permissions: String[]`: chaves `"<recurso>:view"` / `"<recurso>:manage"`. `PERMISSION_RESOURCES` cobre `companies`, `users`, `extensions`, `queues`, `ivr`, `announcements`, `callcenter`, `dids`, `inbound-routes`, `outbound-routes`, `trunks`, `audios`, `time-groups`, `time-conditions`, `holiday-groups`, `request-templates`, `variables`, `variable-conditions`. `cdr` é caso especial: só `view` (recurso somente leitura).
- `requirePermission(resource, action)` checa `getUserPermissions(id)` (`src/utils/auth/access.ts`, cacheado como `getUserCompanyIds`, invalidado em `updateUser`): aplicado em toda rota GET (`:view`) e POST/PUT/PATCH/DELETE (`:manage`) de todos os módulos, exceto as já `requireAdmin`-only (gate redundante ali)
- `GET /auth/me`: `{id, name, username, role, permissions}` do token atual; base pro frontend montar menu/checkboxes
- Guard anti-escalação: `updateUser` só aceita alterar `permissions` se `req.scope.isAdmin`, impedindo um `role="user"` de se autoconceder permissão via self-edit

---

## Cache

**Redis** (`src/config/redis.ts`) - única instância, usada por dois consumidores:
- JTI (`jtiManager.add/exists/revoke/revokeByUserId`) - chave `jti:<uuid>`, valor: userId, TTL: 15min
- Cache de entidades (`src/config/cache.ts`, `CacheManager` singleton) - chave `cache:<namespace>:<key>`, valor JSON serializado
  - `cacheManager.get/set/invalidate(namespace)/invalidateByKey(key)/clear()`
  - Cada módulo tem `src/modules/<name>/cache/<name>.cache.ts` com métodos estáticos tipados
  - Precisa ser Redis (compartilhado), não cache em memória por processo: o backend escala em múltiplas réplicas `web` atrás do nginx (ver seção Deploy), e invalidação feita numa réplica não é vista pelas outras se o cache for local - `node-cache` in-memory já causou esse bug (empresa criada não aparecia na listagem até a réplica errada expirar/reiniciar)
  - Só conectado em processos `web`/`all` (`server.ts`) - `worker` não usa nenhum desses caches

---

## Timezone (`src/utils/timezone.ts`)

Storage é sempre UTC (`@db.Timestamptz`) exceto CDR (ver abaixo). Exibição na API é convertida por empresa.

- `Company.timezone` - string IANA, default `"America/Sao_Paulo"`, só define fuso de exibição (storage continua UTC)
- Hook `preSerialization` em `app.ts`: `collectCompanyIds(payload)` varre a resposta, resolve timezone de cada `companyId` via `getCompanyById` (cacheado), e `formatDatesDeep(payload, env.TZ, tzByCompanyId)` converte todo `Date` pra ISO com offset fixo (`toTzISOString`) - usa `env.TZ` como fallback quando não há empresa no contexto
- Um registro que carrega seu próprio campo `timezone` (ex: a própria Company) vira fonte pra si e pros filhos aninhados, sem precisar de lookup

**CDR é exceção:** `cdr.start/answer/endtime` são `TIMESTAMP` **sem timezone** - o Asterisk grava a hora LOCAL do SO (`America/Sao_Paulo`, setado em `setups/install-asterisk.sh`), não UTC. O driver pg lê esses dígitos como se fossem UTC, então tratar como instante UTC real (como o resto do schema) causa erro de 3h na exibição.
- Filtro por `startDate`/`endDate` (CDR) usa data solta `YYYY-MM-DD`, sem offset - os dígitos já batem 1:1 com o storage naive local, então dá pra construir `new Date(`${data}T00:00:00.000Z`)`/`T23:59:59.999Z` direto, sem conversão de tz
- `formatNaiveLocalISOString(date, tz)` - usar pra formatar `startTime`/`answerTime`/`endTime` na saída do service (retorna string, não `Date`, então o hook genérico não reconverte)
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
`createPrismaMock()` - retorna mock de todos os models Prisma + tabelas Asterisk realtime + `$transaction`
`clearPrismaMock(db)` - `mockReset()` em tudo + restaura `$transaction`

**Integration (`*.routes.test.ts`):**
```ts
import { buildApp } from 'src/test/build-app'
// buildApp() sobe Fastify completo com Redis + todos os módulos
// beforeAll/afterAll timeout 30s
// dados únicos: sufixo Date.now()
```

**Proibido:** `expect(...).resolves.not.toThrow()` - usar `await service.method()` + `toHaveBeenCalled()`

---

## Config (`src/config/env.ts`)
Vars: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `JWT_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `REDIS_URL`, `CORS_ORIGIN`, `RATE_LIMIT_MAX` (1000), `RATE_LIMIT_WINDOW` ("1 second"), `PORT` (3333), `HOST`, `LOG_LEVEL`, `LOG_ENABLED`, `TZ` (America/Sao_Paulo - fallback de exibição, ver seção Timezone), `DATABASE_POOL_SIZE` (10)
- `AGI_HOST`/`AGI_PORT` (127.0.0.1:4573) - FastAGI server (`src/asterisk/agi-server.ts`); Asterisk conecta via `agi://AGI_HOST:AGI_PORT/<script>,<args>`. `AGI_LISTEN_HOST` (`0.0.0.0` por padrão) é separado de propósito - é o endereço que o processo **escuta**, não o que o Asterisk disca; dentro de um container `127.0.0.1` é só o loopback interno dele, não a interface que recebe tráfego encaminhado (ver runbook em `docs/runbooks/agi-silent-failure.md`)
- `AMI_HOST`/`AMI_PORT`/`AMI_USER`/`AMI_SECRET` (127.0.0.1:5038/admin/-) - AMI (`src/asterisk/ami-client.ts`), usado só pra `dialplan reload` sem depender do binário CLI. `AMI_SECRET` é gerado pelo `install-asterisk.sh` (exibido no resumo final) e precisa ser copiado manualmente pro `.env` - indefinido = reload via AMI é pulado (só loga warning, nunca derruba a request)
- `DIALPLAN_EXTRA_DIR` (`/etc/asterisk/dialplan-extra`) - onde `dialplan-file.repository.ts` materializa os contextos estáticos; testes de integração sobrescrevem via `.env.test`
- `ASTERISK_VERSION`/`SIP_LEGACY_ENABLED`/`SIP_PORT`/`PJSIP_PORT` - espelham a escolha feita em `install-asterisk.sh` (passo 13 do script grava esses valores direto no `.env` do backend); expostos via `GET /system/sip-config` pro frontend exibir a configuração correta de provisionamento
- `ELEVENLABS_API_URL`/`ELEVENLABS_MODEL_ID`/`ELEVENLABS_TIMEOUT_MS` - config **não-secreta** compartilhada do TTS (ver seção Audios); a API key em si é por empresa (`Company.elevenLabsApiKey`), não fica no `.env`

---

## Deploy (Docker)

Modelo: Asterisk roda **nativo** na VPS (`setups/install-asterisk.sh` + `setups/odbc-realtime.sh`, fora do Docker); backend + Postgres rodam em container via `docker-compose.yml`/`Dockerfile`/`entrypoint.sh` na raiz do backend. Processo completo (Nginx Proxy Manager, ordem dos passos, firewall) documentado no [README.md raiz](../README.md), seção "Deploy (VPS)" - não duplicar aqui, só a mecânica específica destes 3 arquivos:

- **`Dockerfile`** - multi-stage (`deps` → `builder` → `prod-deps` → `runner`). `builder` roda `bunx prisma generate` com um `DATABASE_URL` placeholder (só pro Prisma Client conseguir gerar; a URL real de runtime vem do `docker-compose.yml`) e `bun run build`. `runner` instala `sox` via apt (conversão de áudio, ver `audio-convert.ts`) - não instala o binário CLI do Asterisk, reload de dialplan é via AMI (`ami-client.ts`), não `asterisk -rx`. Expõe `3333` (API) e `4573` (FastAGI).
- **`PROCESS_ROLE`** (`src/config/env.ts`) - controla o que o processo sobe, checado em `server.ts`: `web` (só Fastify, stateless, escalável em N réplicas), `worker` (AGI + AMI events + jobs de cron, sempre **1 instância só** - porta fixa no AGI e listener único de evento, duplicar causa job rodando 2x em paralelo) ou `all` (default - tudo junto, mesmo processo de sempre; usado em dev local e em VPS que não precisam escalar). `connectRedis()` roda **sempre**, independente do papel - não é só JTI/cache de entidades (lado web), o `worker` também depende do Redis pra gravar o cache de presence AMI (`ami-events.ts`/`writePresence`, ver módulo `realtime`); antes rodava só `if (runsWeb)` e isso fazia toda escrita de presence no worker falhar silenciosa com `"The client is closed"` (engolida por `ami.events.handler.failed`) - bug corrigido, mas fique atento se reaparecer esse log.
- **`docker-compose.yml`** - por padrão só `backend` (`PROCESS_ROLE=all`) + `postgres` + `redis`. Pra escalar (ver README raiz, seção "Escalar backend em réplicas"), vira `backend-worker` (1 réplica) + `backend-web-1..N` (uma por porta - `network_mode: host` não deixa bindar a mesma porta 2x, cada réplica web precisa da sua própria via `PORT` em `environment:`). Todos em `network_mode: host` (backend precisa falar com Asterisk/AMI em `127.0.0.1`, o que também impede resolver `postgres`/`redis` pelo nome - por isso a URL de runtime aponta pra `127.0.0.1:5433`/`127.0.0.1:6379`). Monta `/etc/asterisk/dialplan-extra` e `/var/lib/asterisk/sounds` do host como volume em **todos** os services, não só o worker - rotas HTTP (web) também escrevem dialplan estático (`dialplan-file.repository.ts`) e áudio direto, então réplicas web precisam do mesmo volume. Cada service só sobe depois de `postgres`/`redis` ficarem `service_healthy`, e tem seu próprio `healthcheck` batendo em `GET /health` via `bun -e fetch(...)` (imagem `oven/bun` não tem `curl`/`wget`) - só as réplicas `web` têm essa healthcheck (o `worker` não expõe HTTP).
- **`entrypoint.sh`** - roda `bunx prisma migrate deploy` + `bun dist/scripts/backfill-dialplan-files.js` automaticamente antes de subir o server (`bun dist/server.js`), **exceto** quando `PROCESS_ROLE=web` - evita N réplicas competindo pelo mesmo migrate/backfill ao subir juntas (lock de dialplan é só em memória do processo, não distribuído entre containers); quem roda é sempre o `worker` (ou `all`, dev/single-instance). `odbc-realtime.sh` (que dá os grants Postgres pro usuário `asterisk` usado pelo Realtime/ODBC) deve rodar **depois** do primeiro `docker compose up`, pra que as tabelas já existam.
- **Backfill de dialplan estático** (`src/scripts/backfill-dialplan-files.ts`, bundlado em `dist/scripts/backfill-dialplan-files.js` pelo `bun run build`) - regenera `/etc/asterisk/dialplan-extra/**` pra toda `Company` a partir do banco, chamando `regenerate()` de cada repository em `src/asterisk/destinations/` + `src/asterisk/flows/`. Roda sozinho em todo restart via `entrypoint.sh` (ver acima) - é a "migration" genérica pra qualquer fix no *gerador* de dialplan (ex: bug de sintaxe Asterisk num `buildDialplan`) que não mexe em schema: sem isso, o fix só valeria pra entidades criadas/editadas depois do deploy, e as já materializadas ficariam com o `.conf` antigo até alguém re-salvar cada uma manualmente. Também autocura depois de reinstalação do Asterisk que apaga `dialplan-extra/` mas mantém o banco intacto. Rodar manualmente (sem esperar restart): `bun run src/scripts/backfill-dialplan-files.ts`. Ao adicionar um repository novo com `regenerate()` em `destinations/`/`flows/`, incluir a chamada nesse script também.
- Como o backend está em `network_mode: host`, ele não participa da rede Docker `proxy` (usada por frontend + Nginx Proxy Manager) - pra expor a API por domínio, o Proxy Host no NPM aponta pro gateway da rede `proxy` (IP privado, ex. `172.18.0.1`), não pelo nome do service. O `nftables` gerado por `install-asterisk.sh` já libera essa faixa privada (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) pra porta `3333` - nunca exposta direto à internet. Cada porta de réplica web adicional (`3334`, `3335`, ...) precisa da mesma liberação, uma flag `--private-tcp <porta>` por porta em `setups/install-asterisk.sh` (a flag não aceita lista, é repetível).

### Produção atual (VPS gerenciada via Dokploy) - diverge do modelo acima

IP/hostname/slug real: ver anotação privada fora do repo (não versionar acesso de infra aqui).

Essa VPS **não** usa `network_mode: host` - os containers do backend (worker + réplicas web numeradas) rodam numa rede bridge (`dokploy-network`, Dokploy/Swarm), com `extra_hosts: host.docker.internal:host-gateway` no compose gerado. Isso muda a conectividade com o Asterisk nativo (que continua fora do Docker, só ouvindo em `127.0.0.1`):

- `AMI_HOST` não pode ser `127.0.0.1` (seria o loopback do próprio container, não do host) nem o IP público da VPS (Asterisk não escuta nele) - tem que ser `host.docker.internal`. Na prática isso resolve pra um IP dinâmico dentro de `172.16.0.0/12` (bridge `docker_gwbridge` do Swarm), não uma subnet fixa por container.
- `manager.conf` do Asterisk precisa de `bindaddr = 0.0.0.0` (só `127.0.0.1` não é alcançável de dentro do container) + `permit = 172.16.0.0/255.240.0.0` na seção do usuário AMI (`[admin]`), já que a origem observada varia dentro dessa faixa. Aplicar com `asterisk -rx "manager reload"` (não precisa reiniciar o Asterisk).
- Abrir `bindaddr` pra `0.0.0.0` expõe a porta `5038` na interface pública se não houver firewall de host (essa VPS não tinha nenhum - `iptables -L INPUT` só com policy `ACCEPT`, zero regras). Corrigido com uma regra bloqueando `tcp/5038` especificamente na interface pública (`eth0`), persistida via `iptables-persistent`/`netfilter-persistent` - a ACL do próprio Asterisk (`permit`/`deny` acima) seria a única linha de defesa sem isso.
- `AGI_HOST` continua `127.0.0.1` (é o Asterisk, no host, que conecta na porta publicada `4573:4573` do container - direção contrária à do AMI) - mas **não** "funciona igual em qualquer network mode": `dokploy-network` é rede **overlay** (Swarm), e publicar porta host de um container avulso (não um Swarm service) numa rede overlay não é bem sustentado pelo Docker - o `docker-proxy` de `127.0.0.1:4573` falha em resolver o IP real do container nela (restart de container, do Docker daemon, nada resolve - é estrutural). Precisa de uma **segunda rede, bridge normal** (`sofon-agi-bridge`, `external: true`, criada uma vez via `docker network create --driver bridge sofon-agi-bridge` antes do primeiro deploy) só pra essa porta; `dokploy-network` continua sendo a única rede usada pra falar com postgres/redis. Motivo completo, como foi diagnosticado e checklist de deploy: `docs/runbooks/agi-silent-failure.md`.
- `REDIS_URL`/`DATABASE_URL` apontam pro nome do service (`redis`/`postgres`) dentro da `dokploy-network`, não `127.0.0.1` - só possível justamente por não ser `network_mode: host`.
- Config real em `/etc/dokploy/compose/<slug>/code/backend/` na VPS (`.env` + `docker-compose.yml` gerado pelo Dokploy) - não confundir com a VPS antiga/diferente ainda com o modelo `network_mode: host` documentado acima (não é a produção atual). Nome/IP/slug reais: anotação privada fora do repo.

---

## API - regras de negócio críticas

- `/auth/register` só funciona quando `COUNT(users) === 0`; criado sempre como `admin`
- JTI: access token tem JTI armazenado no Redis - logout deleta o JTI (`jtiManager.revoke`)
- `webhookSlug` em User: UUID gerado no create, nunca alterável
- `extensionId` em User: vincula ao ramal - usado para checar pause/unpause em filas (não-admin só age no próprio ramal)
- DIDs: `UNIQUE(number, companyId)` - mesmo número pode existir em empresas diferentes
- Delete Company → cascade DIDs; Delete OutboundRoute → cascade OutboundDialPatterns
- `position` em OutboundRoute: menor = maior prioridade
- `PUT /outbound-routes/:id/trunks`: substitui lista completa (não aditivo)
- `allowOutbound` em Extension: persiste `ALLOW_OUTBOUND=1/0` em `sip_peers.setvar` / `ps_endpoints.setvar`
- Time Conditions: ao criar/atualizar/deletar, regenera o arquivo estático do contexto `timeconditions` para a empresa via `dialplan-file.repository.ts` - exten `tc-<tcId>`/`tc-<tcId>-matched`, `GotoIfTime` em OR lógico sobre todos os ranges de todos os TGs vinculados. Arquivo em `/etc/asterisk/dialplan-extra/timeconditions/<asteriskId>.conf`, incluído pelo `extensions.conf` estático - sem queries ao banco em tempo de chamada.
- **Route destination** (`src/schemas/route-destination.schema.ts`) - shape compartilhado por Inbound Routes (`destination`), Time Conditions (`trueRoute`/`falseRoute`), Holiday Groups (`trueRoute`/`falseRoute`), Queues (`postQueueDestination`), IVR Menus (`invalidDestination`/`timeoutDestination`/`longDestination`/opção de dígito), Announcements (`destination`), Request Templates (`onSuccess`/`onError`), Variables (`destination`) e Variable Conditions (`trueRoute`/`falseRoute`): `{ type: "extension"|"queue"|"voicemail"|"timecondition"|"holiday"|"announcement"|"ivr"|"request"|"variable-set"|"variable-condition"|"hangup", id?: cuid2 } | null` (`id` obrigatório exceto hangup; `null`/omitido = hangup). Validação de existência/posse centralizada em `validateRouteDestination()` (`src/schemas/route-destination.validate.ts`), usada por todos os services acima - não duplicar esse switch-case ao adicionar novo tipo. **Atenção:** todo novo tipo exige 2 `case` novos em 9 arquivos (`route-destination.validate.ts`, `route-destination-resolver.ts`, `queue.repository.ts`, `announcement.repository.ts`, `inboundroute.repository.ts`, `ivr.repository.ts`, `timecondition.repository.ts`, `holidaygroup.repository.ts` + o próprio novo repositório) - nenhum desses switches tem `default:`, então `bunx tsc --noEmit` aponta os que faltarem assim que o literal entra no union (`bun run build`/`bun build` **não pega isso** - é só bundler, não faz type-check)
- Áudio (`Audio` model, módulo `audios`) é desacoplado de quem o usa: upload é feito uma vez via `POST /audios` (multipart, por empresa) e o `audioId` retornado é referenciado por `Announcement.audioId`/`IvrMenu.audioId` - o mesmo Audio pode ser reaproveitado por mais de um registro. Áudio é convertido automaticamente pra WAV PCM 16-bit mono 8kHz (slin) via `sox` - qualidade sem perdas, compatível com os codecs das trunks (ulaw/alaw) sem resample na chamada. Único arquivo físico por Audio, em `/var/lib/asterisk/sounds/<asteriskId>/<audioId>.wav`
  - `DELETE /audios/:id` desvincula automaticamente (`SetNull`) qualquer Announcement/IvrMenu que o referencie, removendo o dialplan deles na mesma operação (senão ficaria um Playback/Read apontando pro arquivo apagado) - não bloqueia com 409
  - Announcement/IvrMenu usados como destino de rota (`type: "announcement"|"ivr"`) exigem `audioId` vinculado (`hasAudio: true`), senão 400 em `validateRouteDestination`
- `context` de Extension: default `"ramais"`, compartilhado entre todas as empresas - isolamento é feito via sufixo `asteriskId` no `number`/`exten` (ex: `2002_a9e2463c8f`), não por contexto separado. Contextos dinâmicos por empresa (`ramais-<asteriskId>`) **não funcionam** via Realtime: o Asterisk só resolve realtime dialplan pra contextos declarados estaticamente em `extensions.conf` com `switch => Realtime/<contexto>@extensions`. Os demais contextos (`timeconditions`, `announcements`, `ivrs`, `queues-app`, `request-templates`, `holidays`) **contornam essa limitação via arquivos estáticos** por empresa (ver `dialplan-file.repository.ts`) - sem Realtime, sem o problema. `ramais` e `from-trunk-routed` permanecem no banco (Realtime) porque têm escrita frequente (provisionamento de ramais/rotas) e o contexto único já isola por `exten` sufixado.

## API - schemas de input/output por módulo

**Auth**
- Register: `{ name, username(email), password(min6) }` → 201
- Login: `{ username, password }` → `{ accessToken, refreshToken }`
- Refresh: `{ refreshToken }` → `{ accessToken }`
- Logout: → 204

**Users**: `{ id, name, username, role, status, permissions[], extensionId?, webhookSlug(uuid), createdAt, updatedAt }`
- Create: `{ name, username, password, permissions?[] }` → `{ userId }`
- Update: `{ name?, username?, password?, extensionId?, permissions?[] }` (min 1); `permissions` só é aceito se quem chama for admin (ver seção "Permissões granulares" acima)

**Companies** - `{ id, name, doc?, metadata(json), elevenLabsApiKey?, createdAt, updatedAt }`
- Create: `{ name, doc?, metadata?, elevenLabsApiKey?, userId? }`
- Update: `{ name?, doc?, metadata?, elevenLabsApiKey? }` (min 1)
- `elevenLabsApiKey`: key da conta ElevenLabs da própria empresa, usada pelo TTS de Audios (ver seção Audios) - sem fallback global, cada empresa usa sua conta/billing. Retornada em texto puro no GET (mesmo padrão de `Trunk.password`, sem criptografia própria no projeto)

**DIDs** - `{ id, number, companyId, company, createdAt, updatedAt }`
- Create: `{ number(^\d+$), companyId }`; Update: `{ number?, status?, companyId? }` (min 1)
- `companyId` no update reatribui o DID a outra empresa (revenda de número cancelado): valida a empresa destino, checa unicidade `(number, companyId)` no destino, e dentro da mesma transaction apaga as `InboundRoute`/dialplan (`from-trunk-routed`) da empresa antiga - não recria rotas de entrada na nova empresa (destino de rota é decisão de negócio, precisa ser recriado manualmente via `POST /inbound-routes`). Controller exige `assertAccess` tanto na empresa atual quanto na de destino.

**Extensions** - discriminatedUnion por `type: "sip"|"pjsip"`
- Create sip: `{ alias(2-6 dígitos), name, companyId, context?, allowOutbound?, ...sipFields }`
- Create pjsip: `{ alias, name, companyId, context?, allowOutbound?, namedcallgroup?, namedpickupgroup?, ...pjsipFields }`
- Batch: `{ extensions: CreateExtension[] }` (max 50, sem alias duplicado por empresa)
- Update: `{ name?, allowOutbound? }`; `PATCH /:id/password` reseta senha

**Queues** (rotas gateadas por `queues:view`/`queues:manage` - inclui `queue-members`, sem permissão própria por não ter item de menu) - `{ name(alphanum/dash/_), number(^\d+$), companyId, strategy?, musicOnHold?, timeout?, retry?, maxLen?, wrapupTime?, announce?, announceFrequency?, joinEmpty?, leaveWhenEmpty?, weight?, surveyAudioId?, surveyServiceAudioId?, callcenterEnabled? }`
- `number` obrigatório no create, único por empresa (`UNIQUE(number, companyId)`) - usado como destino de inbound routes/time conditions (`Goto(queues-app,<asteriskId>-<number>,1)`)
- strategies: `ringall|leastrecent|fewestcalls|random|rrmemory|linear|wrandom`
- Member add: `{ extensionId, penalty?(0-100), paused? }`; update: `{ penalty?, paused?, pauseReason? }`
- `pauseReason`: persiste em `queue_members.reason_paused` (realtime) só enquanto `paused=true`; some ao despausar
- `surveyAudioId`/`surveyServiceAudioId`: pesquisa de satisfação pós-atendimento com 2 perguntas - `surveyAudioId` é a pergunta sobre o ATENDIMENTO (o agente), `surveyServiceAudioId` é sobre o SERVIÇO CONTRATADO (o plano/produto). All-or-nothing: os dois precisam vir setados juntos (400 se só um vier) ou os dois `null`/omitidos (pesquisa desligada). `hasSurveyAudio` no output só é `true` quando os dois estão setados (ver "Callcenter (Queue Engine)"). Toggle independente de `callcenterEnabled` - funciona mesmo com o engine desligado
- `callcenterEnabled` (default `false`): liga, **só nessa fila**, o AGI de prioridade dinâmica (`RoutingRule`→`QUEUE_PRIO`) e a participação no recálculo periódico de afinidade (`agent-affinity-recalc.job.ts` só reescreve `penalty` de filas com esse flag `true`). `false` = fila 100% nativa (sem hop de AGI de pré-roteamento, penalty nunca tocado pelo job) mesmo que a empresa já tenha `RoutingRule`/`CallRating` configurados - a config é por empresa, o toggle é por fila. Mudar o flag força regeneração do dialplan (muda o número de priorities da exten)
- `AgentCompanyScope` (módulo `callcenter/agents`) vira gate opt-in em `POST /queues/:id/members`: se a empresa da fila já tem qualquer scope cadastrado, só aceita a extensão como membro se ela tiver scope ativo pra essa empresa - empresa sem nenhum scope não é afetada (100% retrocompatível). Esse gate é por empresa, não tem toggle por fila

**Trunks** - discriminatedUnion por `registrationMode: "outbound"|"inbound"`
- outbound: `{ name, companyId, type(sip|pjsip), host, username, password, context?, codecs? }`
- inbound: todos opcionais exceto name/companyId/type
- Update: `{ host?, username?, password?, context?, codecs? }`
- `PATCH /:id/active`: `{ active: boolean }` - toggle que preserva `Trunk` e todas as associações (InboundRoute/OutboundRouteTrunk) no Postgres, mas mexe no Asterisk: `active:false` apaga o endpoint/friend (`ps_endpoints`/`ps_auths`/`ps_aors`/`ps_registrations`/`ps_identifies` ou `iax_friends`) - sem REGISTER, sem inbound, sem outbound (Dial() de outbound route pra um trunk inativo simplesmente falha e cai no próximo da cadeia via `GotoIf DIALSTATUS` já existente, sem precisar excluir o trunk da rota). `active:true` recria o endpoint com os mesmos dados salvos (host/username/password/codecs/etc). Trunk `registrationMode:"custom"` não tem endpoint algum, então o toggle é só a coluna no banco. Idempotente (chamar com o mesmo estado é no-op)

**Outbound Routes** - `{ id, name, companyId, position, patterns[], trunks[], extensions[], createdAt, updatedAt }`
- Create: `{ name, companyId, position?, patterns?[{pattern, prefix?, prepend?}], trunkIds?[] }`
- Update: `{ name?, position? }`; patterns CRUD; trunks: `{ trunkIds[] }` (substitui tudo); extensions: `{ extensionId }`

**Inbound Routes** - `{ id, name, companyId, didId, trunkId, did{id,number}, trunk{id,name}, destination, createdAt, updatedAt }`
- Create: `{ name, companyId, didId, trunkId, destination? }`
- Update: `{ name?, destination? }` (min 1)
- `destination`: route destination compartilhado (ver seção "Route destination" acima)

**Time Groups** - `{ id, name, companyId, ranges[{startTime(HH:MM), endTime(HH:MM), weekdays(mon-sun[]), monthdays?, months?}], createdAt, updatedAt }`
- Update: `{ name?, ranges? }` - ranges substitui lista completa

**Time Conditions** - `{ id, name, companyId, trueRoute, falseRoute, timeGroups[{timeGroup:{id,name}}], createdAt, updatedAt }`
- Create: `{ name, companyId, trueRoute?, falseRoute?, groupIds?[] }`
- Update: `{ name?, trueRoute?, falseRoute? }` (min 1)
- Route format: route destination compartilhado (ver seção "Route destination" acima)

**Holiday Groups** - `{ id, name, companyId, url?, trueRoute, falseRoute, dates[{id,name,month,day}], createdAt, updatedAt }`
- Create: `{ name, companyId, url?, trueRoute?, falseRoute?, dates?[{name, month(1-12), day(1-31)}] }` → `{ holidayGroupId }` - `url` e `dates` são mutuamente exclusivos
- Update: `{ name?, url?, trueRoute?, falseRoute?, dates? }` (min 1; mesma restrição url×dates)
- `url`: endpoint externo que retorna lista de feriados - quando configurada, `dates` é read-only via API (gerenciado pelo job `holiday-resync.job.ts` que substitui as datas periodicamente); `url: null` converte pro modo manual
- `dates` max 50 por grupo; `trueRoute`/`falseRoute`: route destination compartilhado
- Dialplan: contexto fixo `holidays`, exten `hol-<id>`, `GotoIfTime` por datas (month/day, sem hora/weekday)
- `UNIQUE(name, companyId)`

**Audios** (rotas gateadas por `audios:view`/`audios:manage`, ver "Permissões granulares") - `{ id, name, companyId, source("UPLOAD"|"TTS"), ttsText?, ttsVoiceId?, createdAt, updatedAt }`
- Create: `POST /audios` - multipart/form-data com campos de texto `name`+`companyId` **antes** do arquivo, até 15MB. Converte pra WAV slin 8kHz mono 16-bit via `sox` → `{ audioId }`
- Create por TTS: `POST /audios/tts` - `{ name, companyId, text(max 2500), voiceId }` (JSON, mesmo rate limit de upload). Gera o áudio via ElevenLabs (`src/modules/audios/providers/elevenlabs.provider.ts`, endpoint `/v1/text-to-speech/{voiceId}`, `model_id` fixo em `ELEVENLABS_MODEL_ID`), salva `source:"TTS"` + `ttsText`/`ttsVoiceId`, e passa pelo mesmo `sox` de sempre → `{ audioId }`. 400 se a empresa não tiver `elevenLabsApiKey` configurada
- `GET /audios/tts/voices?companyId=` - proxy cacheado (1h, por empresa) de `GET /v1/voices` da ElevenLabs, usando a key da própria empresa
- Update: `PATCH /:id` - `{ name }` (só rename)
- Delete: `DELETE /:id` - remove registro e `.wav`; desvincula (não bloqueia) Announcement/IvrMenu que o referenciem, removendo o dialplan deles
- `UNIQUE(name, companyId)`
- Delete Company → cascade Audios (dialplan dos consumidores limpo antes; pasta `/var/lib/asterisk/sounds/<asteriskId>/` inteira removida)

**Announcements** (rotas gateadas por `announcements:view`/`announcements:manage`) - `{ id, name, companyId, audioId, hasAudio, destination, createdAt, updatedAt }`
- Create: `{ name, companyId, audioId?, destination? }` → `{ announcementId }` (com `audioId` já sai com dialplan; sem ele fica pendente)
- Update: `{ name?, audioId?, destination? }` (min 1; `audioId: null` desvincula e remove o dialplan)
- `destination`: route destination compartilhado - para onde vai após o áudio tocar (null/omitido = Hangup)
- Delete: remove registro e dialplan (`announcements`/`ann-<id>`) - não mexe no Audio vinculado
- Delete Company → cascade Announcements (dialplan) + cascade Audios (ver seção Audios)

**IVR Menus** (`/ivr-menus`) - `{ id, name, companyId, audioId, hasAudio, maxDigits, digitTimeout, invalidRetries, invalidDestination, timeoutRetries, timeoutDestination, longDestination, options[{id,digit,destination}], createdAt, updatedAt }`
- Create: `{ name, companyId, audioId?, maxDigits?, digitTimeout?, invalidRetries?, invalidDestination?, timeoutRetries?, timeoutDestination?, longDestination?, options?[{digit, destination?}] }` → `{ ivrMenuId }`
- Update: `{ name?, audioId?, ...resto opcional, options? }` (min 1; `options` substitui lista completa; `audioId: null` desvincula)
- `maxDigits > 1` permite sequência longa (ex: CPF) tratada via `longDestination` quando não bate com nenhuma opção de 1 dígito
- Delete: remove registro e dialplan (`ivrs`/`ivr-<id>`) - não mexe no Audio vinculado
- Delete Company → cascade IVR Menus (dialplan) + cascade Audios (ver seção Audios)

**Request Templates** - `{ id, name, companyId, method, url, headers?, body?, timeoutMs, variableMappings[], onSuccess, onError, createdAt, updatedAt }`
- Create: `{ name, companyId, method?("GET"), url, headers?(json), body?(json), timeoutMs?(5000), variableMappings?[{path, variable}], onSuccess?, onError? }`
- Update: `{ method?, url?, headers?, body?, timeoutMs?, variableMappings?, onSuccess?, onError? }` (min 1)
- `variableMappings`: max 20; `path` = JSON path sobre a resposta HTTP (ex: `data.client[0].id`), `variable` = nome da variável de canal setada via AGI (`SET VARIABLE`) - disponível no dialplan após o request
- `onSuccess`/`onError`: route destination compartilhado - destino após execução AGI
- Executado em tempo de chamada via AGI server (`src/asterisk/agi-server.ts`); placeholders `{{VAR}}` em `url`/`headers`/`body` resolvidos via `AGI GET VARIABLE`
- `timeoutMs` default 5000; `UNIQUE(name, companyId)`

**Variables** (`/variables`) - `{ id, name, companyId, assignments[{variable, value}], destination, createdAt, updatedAt }`
- Create: `{ name, companyId, assignments[{variable, value}](1-20), destination? }` → `{ variableSetId }`
- Update: `{ name?, assignments?, destination? }` (min 1)
- `assignments`: `variable` = identificador simples (`^[A-Za-z_][A-Za-z0-9_]*$`); `value` pode conter interpolação nativa do Asterisk (`${OUTRAVAR}`), resolvida em tempo de chamada pelo próprio `Set()` - sem AGI. `value` só bloqueia aspas/backslash (não pode quebrar a linha de dialplan gerada)
- `destination`: route destination compartilhado - para onde vai depois de setar as variáveis (null/omitido = Hangup)
- Dialplan: contexto fixo `variables`, exten `var-<id>`, um `Set()` por assignment seguido do Goto/Hangup
- `UNIQUE(name, companyId)`
- Delete Company → cascade Variables (dialplan)

**Variable Conditions** (`/variable-conditions`) - `{ id, name, companyId, combinator, rules[{variable, operator, value?}], trueRoute, falseRoute, createdAt, updatedAt }`
- Create: `{ name, companyId, combinator?("and"), rules[{variable, operator, value?}](1-20), trueRoute?, falseRoute? }` → `{ variableConditionId }`
- Update: `{ name?, combinator?, rules?, trueRoute?, falseRoute? }` (min 1)
- `operator`: `filled|empty` (sem `value`) · `length_eq|length_neq|length_gt|length_gte|length_lt|length_lte` (`value` numérico, compara `LEN()` da variável) · `eq|neq` (`value` string) · `contains|regex` (`value` = substring literal/pattern POSIX ERE, avaliado via `REGEX()`) · `gt|gte|lt|lte` (`value` numérico, compara a variável cru)
- `variable`: identificador simples ou chamada de função Asterisk (`CALLERID(num)`, `DB(family/key)`)
- `combinator`: `"and"` (todas as regras devem bater) ou `"or"` (qualquer uma) - combina via `GotoIf(cond?label1:label2)` (destino omitido = continua na próxima priority), mesmo truque do `GotoIfTime` de Time Conditions
- `value`: só bloqueia aspas/backslash (evita quebrar a expressão Asterisk montada); `contains` escapa metacaracteres regex internamente antes de virar pattern
- `trueRoute`/`falseRoute`: route destination compartilhado
- Dialplan: contexto fixo `variable-conditions`, exten `varcond-<id>` (+ `-matched` no combinator `or`, `-fail` no `and`)
- `UNIQUE(name, companyId)`
- Delete Company → cascade Variable Conditions (dialplan)

**CDR** - `GET /cdr` - `{ records[], total, limit, page }`
- Query obrigatória: `companyId`; opcionais: `startDate`/`endDate` (`YYYY-MM-DD`, cobrem o dia inteiro 00:00:00–23:59:59.999, sem offset/hora), `src`, `dst`, `callStatus` (enum disposition), `limit`(max 200), `page`(default 1), `order`(asc|desc, default desc - aplica em startTime+id)
- Paginação por offset (`skip`/`take` do Prisma) - sem cursor; `page` permite navegação/salto direto
- Isolamento por empresa via `accountcode = Company.asteriskId` (não por FK)
- `callStatus` na query mapeia pra coluna `disposition` no banco; na resposta o campo também sai como `callStatus` (não `disposition`) - nome escolhido por ser mais intuitivo pro consumidor da API
- `startTime`/`answerTime`/`endTime`: ver seção Timezone - são hora local naive do CDR nativo do Asterisk, formatados na saída via `formatNaiveLocalISOString`, nunca como UTC direto. Filtro por data não precisa de conversão de tz: os dígitos de `startDate`/`endDate` já batem 1:1 com o storage naive local

**Callcenter (Queue Engine)** - motor de distribuição de chamadas de fila além do `app_queue` nativo: prioridade dinâmica por regra configurável, elegibilidade agente×empresa e roteamento por afinidade (nota de atendimento). Mantém o `app_queue` nativo fazendo o trabalho de distribuição em si (ring/MOH/timeout/estratégia) - sem AMI/ARI, tudo via 2 mecanismos nativos do Asterisk + AGI de curta duração (`src/asterisk/agi-server.ts`).

**`Queue.callcenterEnabled`** (default `false`) - toggle **por fila** que liga prioridade dinâmica + afinidade (ver passos 1/2/5 abaixo). `false` = fila roda 100% nativa, mesmo que a empresa já tenha `RoutingRule`/`CallRating` configurados pra outras filas - a config (regra, nota) é por empresa, mas o efeito na distribuição só existe nas filas com o flag ligado. Pesquisa de satisfação (`surveyAudioId`) e elegibilidade agente×empresa (`AgentCompanyScope`) **não** dependem desse flag - têm toggle próprio (ver seção Queues e passo 7).

**Como funciona (fluxo de uma chamada, passo a passo):**
1. Chamada chega em `queues-app`, exten da fila. Se `callcenterEnabled=true`, priority 1 → `AGI(queue-route)`: o handler (`handleQueueRoute`) lê `CALLERID(num)` + `ROUTING_TRUNK_ID` (setado desde a entrada em `from-trunk-routed`, ver `inboundroute.repository.ts`), chama `RoutingRulesService.resolveActiveRule(companyId, {callerId, at, timezone, trunkId})`, e se alguma `RoutingRule` ativa bater (por `trunkId`/`callerIdPattern`/`weekdays`/`startTime`-`endTime`), faz `SET VARIABLE QUEUE_PRIO=<priority>` no canal. Não achou regra → não seta nada. Se `callcenterEnabled=false`, esse priority nem existe no dialplan gerado (`regenerate()` pula a linha).
2. Priority seguinte → `Queue(<asteriskName>)`, o `app_queue` nativo de sempre. Ele já lê `QUEUE_PRIO` sozinho pra furar a fila (prioridade maior = atendido antes de quem tem prioridade menor/sem prioridade) e já tenta os membros em ordem de `penalty` crescente (menor primeiro) - **independente da strategy** configurada (ringall/leastrecent/etc). O `penalty` de cada membro é o que o job de afinidade mantém atualizado (passo 5, só pra filas com `callcenterEnabled=true`) - é assim que a fila "prefere" o agente com melhor nota daquele cliente sem precisar de fila-tier nem lógica nova de distribuição.
3. Quando um agente atende e depois desliga primeiro, o `Queue()` retorna e o dialplan segue pra próxima priority → `AGI(queue-survey)` (se o *cliente* desligar primeiro, o canal dele já não existe mais e a fila para aqui - pesquisa não dispara, ver bullet de limitação abaixo). Essa linha existe **independente** de `callcenterEnabled`. O handler (`handleQueueSurvey`) lê `MEMBERINTERFACE` (variável nativa que o `Queue()` seta com quem atendeu, ex. `PJSIP/2002_ast1`), resolve a `Extension` por `number`, confere se a fila tem os **2** áudios de pesquisa configurados (`surveyAudioId` e `surveyServiceAudioId`) - se sim, guarda `extensionId`/`companyId` em variáveis de canal e dá `Goto` pro contexto `callcenter-surveys`.
4. `callcenter-surveys` (`src/asterisk/destinations/callcenter-survey.repository.ts`) toca **2 perguntas sequenciais no mesmo exten** (`survey-<queueId>`), cada uma com `Read()` de 1 dígito (1-5) + retry (timeout/inválido, 2 tentativas): pergunta 1 é sobre o ATENDIMENTO, pergunta 2 sobre o SERVIÇO CONTRATADO. Falhar (timeout ou esgotar tentativas) em qualquer uma pula direto pro `Hangup` final, sem tentar a próxima pergunta sem resposta válida. A cada dígito válido, o dialplan chama `AGI(survey-result,<queueId>,<category>,<digito>)` (`category` = `"atendimento"` ou `"servico"`) → `handleSurveyResult` recupera as variáveis salvas no passo 3 + `CALLERID(num)` e persiste um `CallRating` (`companyId, extensionId, number, score, category`) direto em processo via `RatingsService.createRating`.
5. A cada 5min, `agent-affinity-recalc.job.ts` roda `AffinityService.recalculateAffinity()`: agrupa `CallRating` (só `category="atendimento"` - a nota de serviço contratado é só informativa, não mede desempenho do agente) por `extensionId`×`companyId` (`groupBy` + média), faz upsert em `AgentAffinity` (sempre, pra todo agente com nota - é só dado agregado). Pra cada empresa afetada chama `recalculatePenaltiesForCompany`, que só ranqueia/reescreve `penalty` dos membros de filas com `callcenterEnabled=true` daquela empresa. Fecha o loop com o passo 2.
6. Se não houver agente disponível, o comportamento é o `joinEmpty`/`leaveWhenEmpty` nativo do `Queue` (campos já existentes no model) - sem lógica de fallback adicional, é o próprio `app_queue` decidindo.
7. Em paralelo, na hora de **adicionar** um agente numa fila (`POST /queues/:id/members`), `assertAgentEligible` bloqueia (403) se a empresa da fila já tiver algum `AgentCompanyScope` cadastrado e a extensão não tiver um scope ativo pra ela - é o controle de "quais empresas esse atendente pode atender". Empresa sem nenhum scope cadastrado não é afetada (feature opt-in), e essa checagem independe de `callcenterEnabled`.

- **`AgentCompanyScope`** (`/callcenter/agents`) - `{ extensionId, companyId, active }`, `UNIQUE(extensionId, companyId)`. Allow-list de quais empresas um ramal pode atender - permite ramal compartilhado entre empresas (cenário BPO). Gate opt-in em `POST /queues/:id/members` (ver seção Queues).
- **`RoutingRule`** (`/callcenter/routing-rules`) - `{ name, companyId, priority(int), conditions, active }`, `UNIQUE(name, companyId)`. `conditions`: `{ trunkId?, callerIdPattern?, weekdays?(mon-sun[]), startTime?/endTime?(HH:MM) }` - mesmo vocabulário de Time Groups. `trunkId` validado contra a mesma `companyId` da regra (`assertTrunkBelongsToCompany`). Avaliado por `RoutingRulesService.resolveActiveRule(companyId, {callerId, at, timezone, trunkId})`: maior `priority` entre as regras ativas cujas conditions batem (trunkId por igualdade; callerIdPattern via regex contra `CALLERID(num)`; weekday/horário via `Intl.DateTimeFormat` no timezone da empresa).
- **`CallRating`** (`/callcenter/ratings`) - `{ companyId, extensionId, number, uniqueid?, score(1-5), category("atendimento"|"servico", default "atendimento") }`. `GET` com filtro `companyId`(obrigatório)/`extensionId`/`number`/`score`(1-5)/`category`/`startDate`/`endDate`/`limit`/`order` - mesmo padrão de filtro do CDR. Populado pela pesquisa de satisfação IVR pós-atendimento (2 perguntas, ver dialplan abaixo), não por webhook externo.
- **`AgentAffinity`** - `{ extensionId, companyId, score, sampleSize }`, `UNIQUE(extensionId, companyId)`. Só leitura/derivado - recalculado periodicamente por `src/jobs/agent-affinity-recalc.job.ts` (a cada 5min, mesmo padrão `setInterval` de `holiday-resync.job.ts`) a partir da média de `CallRating` por extensão×empresa (`AffinityService.recalculateAffinity`, `src/modules/callcenter/affinity/affinity.service.ts`). Não tem CRUD/rota própria.

**Dialplan de `queues-app` (`src/asterisk/queue.repository.ts`, `AsteriskQueueRepository.regenerate`)** - priorities geradas dinamicamente conforme `callcenterEnabled` (era fixo 1-2 antes do Callcenter):
```
; callcenterEnabled=true
exten,1,AGI(agi://HOST:PORT/queue-route,<queueId>)    ; seta QUEUE_PRIO a partir de RoutingRule
exten,2,Queue(<asteriskName>)                          ; app_queue nativo, inalterado
exten,3,AGI(agi://HOST:PORT/queue-survey,<queueId>)   ; captura MEMBERINTERFACE p/ pesquisa
exten,4,<postQueueDestination app/appdata>             ; mesmo destino de sempre

; callcenterEnabled=false (default) - sem o AGI de pré-roteamento, prioridades renumeradas
exten,1,Queue(<asteriskName>)
exten,2,AGI(agi://HOST:PORT/queue-survey,<queueId>)   ; pesquisa continua independente do toggle
exten,3,<postQueueDestination app/appdata>
```
- `QUEUE_PRIO`: variável nativa que `Queue()` já lê pra furar a fila - não precisa fila-tier física.
- Afinidade/skill: **não** é feita por fila-tier - `app_queue` agrupa membros por `penalty` (menor tentado primeiro, **independente da strategy**), então `agent-affinity-recalc.job.ts` só recalcula `queue_members.penalty` (realtime) por rank de `AgentAffinity.score` dentro de cada fila com `callcenterEnabled=true`. Zero mudança de dialplan pra isso.
- Pesquisa de satisfação só dispara quando o **agente desliga primeiro** (`MEMBERINTERFACE` só populado nesse caso - comportamento nativo do `Queue()`, mesmo motivo do `postQueueDestination` já existente). Se o **cliente** desligar primeiro, a pesquisa não roda - limitação física de qualquer IVR pós-chamada (canal já não existe), não um bug. Cobertura parcial é o comportamento esperado; 100% de cobertura exigiria callback outbound via AMI/ARI (fora de escopo).
- `agi-server.ts` despacha por `agi_network_script` (segmento de path da URL `agi://host:port/<script>,<args>`): `queue-route` (seta `QUEUE_PRIO`), `queue-survey` (captura agente, Goto pra `callcenter-surveys`), `survey-result` (persiste a nota via `RatingsService.createRating` direto em processo), default (sem script reconhecido) = Request Template, comportamento antigo preservado.

---

## Status de implementação

Legend: `[x]` implementado + testado (unit + integration) | `[~]` implementado, só testes unit | `[ ]` pendente

| Módulo                                                  | Rotas                                                                                      | Unit   | Integration |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | ----------- |
| Health                                                  | `GET /health`                                                                              | -      | -           |
| Auth                                                    | POST register/login/refresh/logout                                                         | `[x]`  | `[x]`       |
| Users                                                   | GET list/:id/:id/companies · POST · PUT · DELETE                                           | `[x]`  | `[x]`       |
| Companies                                               | GET list/:id · POST · PUT · DELETE                                                         | `[x]`  | `[x]`       |
| DIDs                                                    | GET list/:id/company/:id · POST · PUT · DELETE                                             | `[x]`  | `[x]`       |
| Extensions                                              | GET list/:id · POST · POST /batch · PUT · PATCH /password · DELETE                         | `[x]`  | `[x]`       |
| Queues                                                  | GET list/company/:id/:id · POST · PUT · DELETE                                             | `[x]`  | `[x]`       |
| Queue Members                                           | GET/POST/PUT/DELETE `/queues/:id/members`                                                  | `[x]`  | `[ ]`       |
| Trunks                                                  | GET list/:id · POST · PUT · DELETE                                                         | `[~]`  | `[ ]`       |
| Outbound Routes                                         | GET list/:id · POST · PUT · DELETE · patterns CRUD · PUT /trunks · POST/DELETE /extensions | `[x]`  | `[x]`       |
| Inbound Routes                                          | GET list/:id · POST · PUT · DELETE                                                         | `[x]`  | `[x]`       |
| Time Groups                                             | GET list/:id · POST · PUT · DELETE                                                         | `[x]`  | `[x]`       |
| Time Conditions                                         | GET list/:id · POST · PUT · DELETE                                                         | `[x]`  | `[x]`       |
| Holiday Groups                                          | GET list/:id · POST · PUT · DELETE                                                         | `[~]`  | `[ ]`       |
| CDR                                                     | GET /cdr                                                                                   | `[~]`  | `[ ]`       |
| Announcements                                           | GET list/:id · POST · PATCH · DELETE                                                       | `[~]`  | `[ ]`       |
| IVR Menus                                               | GET list/:id · POST · PUT · DELETE                                                         | `[~]`  | `[ ]`       |
| Request Templates                                       | GET list/:id · POST · PUT · DELETE                                                         | `[~]`  | `[ ]`       |
| Audios                                                  | GET list/:id · POST · PATCH · DELETE                                                       | `[~]`  | `[ ]`       |
| Variables                                               | GET list/:id · POST · PATCH · DELETE                                                       | `[~]`  | `[ ]`       |
| Variable Conditions                                     | GET list/:id · POST · PUT · DELETE                                                         | `[~]`  | `[ ]`       |
| Callcenter Agents                                       | GET list/company/:id · POST · PATCH · DELETE                                               | `[x]`  | `[ ]`       |
| Callcenter Routing Rules                                | GET list/company/:id/:id · POST · PUT · DELETE                                             | `[x]`  | `[ ]`       |
| Callcenter Ratings                                      | GET /callcenter/ratings · POST                                                             | `[x]`  | `[ ]`       |
| Callcenter Engine (AGI route/survey + job de afinidade) | sem rota HTTP própria                                                                      | `[~]`¹ | `[ ]`       |

¹ `resolveActiveRule`, `parseMemberInterface` e `recalculateAffinity`/`recalculatePenaltiesForCompany` têm teste unit; os handlers AGI em si (`handleQueueRoute`/`handleQueueSurvey`/`handleSurveyResult`) não têm teste - mesma limitação de `handleRequestTemplate`, nunca testado neste projeto (protocolo AGI via socket TCP cru).

**Pendências de teste:**
- `[ ]` Integration tests: Queue Members, Trunks, Holiday Groups, CDR, Announcements, IVR Menus, Request Templates, Audios, Variables, Variable Conditions, Callcenter (todos os submódulos)
- `[ ]` Smoke ao vivo do fluxo AGI de fila (`queue-route`/`queue-survey`/`survey-result`) contra um Asterisk real - `QUEUE_PRIO`/`MEMBERINTERFACE` validados por conhecimento de Asterisk, não testados neste projeto ainda
