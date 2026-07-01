# Sofon PABX — Backend Spec

## Stack
- Runtime: Bun
- Framework: Fastify
- ORM: Prisma (PostgreSQL)
- Cache: Redis (JTI revogação)
- Auth: JWT RS256 — access 15min, refresh 7d
- Validação: Zod
- Testes: `bun run test` (todos) | `bun run test:unit` (serviços, sem DB) | `bun run test:integration` (rotas, com DB)

## Auth & RBAC
- Roles: `admin` | `reseller` | `user`
- Access token: Bearer JWT (RS256), 15min
- Refresh token: JWT (RS256), 7d, revogável via JTI no Redis
- Rate limit: 100 req/min por IP

## Convenções de código
- Sem comentários óbvios — só o WHY não-óbvio
- Sem error handling para casos impossíveis
- Validação apenas em boundaries (input do usuário, APIs externas)
- Zod para validação de request body/params
- Nunca rodar DELETE/migrate/drop sem confirmação explícita

## Testes
- **Unit** (`*.service.test.ts`): Prisma mockado via `src/test/mocks/prisma.mock.ts` — sem DB, sem rede
  - `createPrismaMock()` retorna o mock; `clearPrismaMock(db)` usa `mockReset()` + restaura `$transaction`
  - Mocks de módulos com `mock.module()` no topo do arquivo (antes dos imports)
- **Integration** (`*.routes.test.ts`): sobe Fastify completo contra DB real
  - `beforeAll`/`afterAll` com timeout de 30s; usar sufixo `Date.now()` para dados únicos por run
- Nunca usar `expect(...).resolves.not.toThrow()` no Bun — usar `await service.method()` + `toHaveBeenCalled()`

---

## API Spec

**Base URL:** `http://localhost:3333`

### Schemas reutilizáveis
| Nome | Tipo | Regra |
|------|------|-------|
| Cuid2 | string | `^[a-z0-9]{24,}$` |
| Email | string (email) | — |
| Password | string | minLength: 6 |
| Timestamp | string (date-time) | — |

### Respostas de erro padrão
| Código | Quando |
|--------|--------|
| 400 | Validation error (campo + mensagem) |
| 401 | Token ausente/inválido/expirado |
| 403 | Role insuficiente |
| 404 | Recurso não encontrado |
| 409 | Conflito (recurso já existe) |

---

### Health
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/health` | Não | — | Status do serviço |

---

### Auth
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| POST | `/auth/register` | Não | — | Cria 1º usuário (admin). Falha 409 se já existir usuário |
| POST | `/auth/login` | Não | — | Retorna `accessToken` + `refreshToken` |
| POST | `/auth/refresh` | Não | — | Recebe `refreshToken`, retorna novo `accessToken` |
| POST | `/auth/logout` | Sim | qualquer | Revoga tokens via JTI no Redis → 204 |

**Register body:** `{ name, username (email), password }`  
**Login body:** `{ username (email), password }`  
**Refresh body:** `{ refreshToken }`

---

### Users
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/users` | Sim | admin | Lista todos |
| POST | `/users` | Sim | admin | Cria usuário; 409 se email duplicado |
| GET | `/users/:id` | Sim | qualquer | Busca por ID |
| PUT | `/users/:id` | Sim | qualquer | Atualiza (mínimo 1 campo) |
| DELETE | `/users/:id` | Sim | admin | Remove |
| GET | `/users/:id/companies` | Sim | qualquer | Empresas do usuário |

**User schema:** `{ id, name, username, role, status, extensionId (nullable), webhookSlug (uuid), createdAt, updatedAt }`  
**Create body:** `{ name, username, password }` → retorna `{ userId }`  
**Update body:** `{ name?, username?, password?, extensionId? }` (min 1 campo)

---

### Companies
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/companies` | Sim | qualquer | Admin → todas; outros → só as suas |
| POST | `/companies` | Sim | admin, reseller | Cria empresa |
| GET | `/companies/:id` | Sim | qualquer | Busca por ID |
| PUT | `/companies/:id` | Sim | qualquer | Atualiza (mínimo 1 campo) |
| DELETE | `/companies/:id` | Sim | admin | Remove + cascade DIDs |
| GET | `/companies/users/:id_user` | Sim | qualquer | Empresas de um usuário |

**Company schema:** `{ id, name, doc (CNPJ/CPF, nullable), metadata (object), createdAt, updatedAt }`  
**Create body:** `{ name, doc?, metadata?, userId? }`  
**Update body:** `{ name?, doc?, metadata? }` (min 1 campo)

---

### DIDs
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/dids` | Sim | qualquer | Admin → todos; outros → só das suas empresas |
| POST | `/dids` | Sim | qualquer | Cria DID; UNIQUE(number, companyId) |
| GET | `/dids/:id` | Sim | qualquer | Busca por ID |
| PUT | `/dids/:id` | Sim | qualquer | Atualiza número |
| DELETE | `/dids/:id` | Sim | qualquer | Remove |
| GET | `/dids/company/:id_company` | Sim | qualquer | DIDs de uma empresa |

**DID schema:** `{ id, number (só dígitos), companyId, company (Company), createdAt, updatedAt }`  
**Create body:** `{ number (^\d+$), companyId }`  
**Update body:** `{ number? }`

---

### Extensions
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/extensions` | Sim | qualquer | Lista ramais — query obrigatória: `?companyId=` |
| GET | `/extensions/:id` | Sim | qualquer | Busca por ID |
| POST | `/extensions` | Sim | qualquer | Cria ramal (sip ou pjsip) |
| POST | `/extensions/batch` | Sim | qualquer | Cria ramais em lote (max 50) |
| PUT | `/extensions/:id` | Sim | qualquer | Atualiza — só campo `name` |
| PATCH | `/extensions/:id/password` | Sim | qualquer | Reseta senha do ramal |
| DELETE | `/extensions/:id` | Sim | qualquer | Remove |

**Create body (discriminatedUnion por `type`):**
- `type: "sip"` → `{ alias (2-6 dígitos), name, companyId, context?, allowOutbound? (default true), ...sipFields }`
- `type: "pjsip"` → `{ alias (2-6 dígitos), name, companyId, context?, allowOutbound? (default true), namedcallgroup?, namedpickupgroup?, ...pjsipFields }`

**Batch body:** `{ extensions: CreateExtension[] }` — sem alias duplicado por empresa no mesmo lote  
**Update body:** `{ name?, allowOutbound? }`  
**Nota:** `sip` grava em `sip_peers`; `pjsip` grava em `ps_endpoints` + `ps_aors`  
**PJSIP Groups:** `namedcallgroup` e `namedpickupgroup` permitem group pickup entre ramais  
**allowOutbound:** persiste `ALLOW_OUTBOUND=1/0` em `sip_peers.setvar` / `ps_endpoints.setvar` — o dialplan de rotas de saída checa essa variável para bloquear chamadas externas

---

### Queues
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/queues` | Sim | qualquer | Lista filas |
| GET | `/queues/company/:id_company` | Sim | qualquer | Filas de uma empresa |
| GET | `/queues/:id` | Sim | qualquer | Busca por ID |
| GET | `/queues/:id/members` | Sim | qualquer | Membros da fila |
| POST | `/queues` | Sim | qualquer | Cria fila |
| POST | `/queues/:id/members` | Sim | qualquer | Adiciona membro |
| PUT | `/queues/:id` | Sim | qualquer | Atualiza fila |
| PUT | `/queues/:id/members/:memberId` | Sim | qualquer | Atualiza membro |
| DELETE | `/queues/:id` | Sim | qualquer | Remove fila |
| DELETE | `/queues/:id/members/:memberId` | Sim | qualquer | Remove membro |

**Create body:** `{ name (alphanum/dash/underscore), number? (só dígitos), companyId, strategy?, musicOnHold?, timeout?, retry?, maxLen?, wrapupTime?, announce?, announceFrequency?, joinEmpty?, leaveWhenEmpty?, weight? }`  
**Strategies:** `ringall | leastrecent | fewestcalls | random | rrmemory | linear | wrandom`  
**Add member body:** `{ extensionId, penalty? (0-100), paused? }`  
**Update member body:** `{ penalty?, paused? }`  
**Nota:** `PUT /queues/:id/members/:memberId` — não-admin só pode pause/unpause no próprio ramal (via `user.extensionId`)

---

### Trunks
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/trunks` | Sim | qualquer | Lista trunks — query obrigatória: `?companyId=` |
| GET | `/trunks/:id` | Sim | qualquer | Busca por ID |
| POST | `/trunks` | Sim | qualquer | Cria trunk |
| PUT | `/trunks/:id` | Sim | qualquer | Atualiza trunk |
| DELETE | `/trunks/:id` | Sim | qualquer | Remove trunk |

**Create body (discriminatedUnion por `registrationMode`):**
- `registrationMode: "outbound"` → `{ name, companyId, type (sip|pjsip), host, username, password, context?, codecs? }`
- `registrationMode: "inbound"` → `{ name, companyId, type (sip|pjsip), host?, username?, password?, context?, codecs? }`

**Update body:** `{ host?, username?, password?, context?, codecs? }`

---

### Outbound Routes
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/outbound-routes` | Sim | qualquer | Lista rotas — query obrigatória: `?companyId=` |
| GET | `/outbound-routes/:id` | Sim | qualquer | Busca por ID |
| POST | `/outbound-routes` | Sim | qualquer | Cria rota com patterns + trunks |
| PUT | `/outbound-routes/:id` | Sim | qualquer | Atualiza nome/posição |
| DELETE | `/outbound-routes/:id` | Sim | qualquer | Remove + cascade patterns |
| POST | `/outbound-routes/:id/patterns` | Sim | qualquer | Adiciona dial pattern |
| PUT | `/outbound-routes/:id/patterns/:patternId` | Sim | qualquer | Atualiza dial pattern |
| DELETE | `/outbound-routes/:id/patterns/:patternId` | Sim | qualquer | Remove dial pattern |
| PUT | `/outbound-routes/:id/trunks` | Sim | qualquer | Define lista de trunks da rota |
| POST | `/outbound-routes/:id/extensions` | Sim | qualquer | Restringe rota a um ramal |
| DELETE | `/outbound-routes/:id/extensions/:extensionId` | Sim | qualquer | Remove restrição de ramal |

**Create body:** `{ name, companyId, position?, patterns?: [{ pattern, prefix?, prepend? }], trunkIds?: string[] }`  
**Update body:** `{ name?, position? }`  
**Pattern body:** `{ pattern, prefix?, prepend? }`  
**Trunks body:** `{ trunkIds: string[] }` — substitui lista completa  
**Extension body:** `{ extensionId }`

**OutboundRoute schema:** `{ id, name, companyId, position, patterns (OutboundDialPattern[]), trunks (Trunk[]), extensions (Extension[]), createdAt, updatedAt }`  
**OutboundDialPattern schema:** `{ id, outboundRouteId, pattern, prefix, prepend }`

---

### Time Groups
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/time-groups` | Sim | qualquer | Lista grupos — query obrigatória: `?companyId=` |
| GET | `/time-groups/:id` | Sim | qualquer | Busca por ID |
| POST | `/time-groups` | Sim | qualquer | Cria grupo com ranges |
| PUT | `/time-groups/:id` | Sim | qualquer | Atualiza nome e/ou ranges |
| DELETE | `/time-groups/:id` | Sim | qualquer | Remove |

**Create body:** `{ name, companyId, ranges: [{ startTime (HH:MM), endTime (HH:MM), weekdays (mon-sun[]), monthdays? ("*" ou "1-31"), months? ("*" ou "jan-dec") }] }`  
**Update body:** `{ name?, ranges? }` (min 1 campo) — ranges substitui a lista completa  
**TimeGroup schema:** `{ id, name, companyId, ranges (TimeRange[]), createdAt, updatedAt }`

---

### Time Conditions
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/time-conditions` | Sim | qualquer | Lista condições — query obrigatória: `?companyId=` |
| GET | `/time-conditions/:id` | Sim | qualquer | Busca por ID |
| POST | `/time-conditions` | Sim | qualquer | Cria condição |
| PUT | `/time-conditions/:id` | Sim | qualquer | Atualiza nome/rotas |
| DELETE | `/time-conditions/:id` | Sim | qualquer | Remove + limpa dialplan |

**Create body:** `{ name, companyId, trueRoute?, falseRoute?, groupIds?: string[] }`  
**Update body:** `{ name?, trueRoute?, falseRoute? }` (min 1 campo)  
**Route format:** `{ type: "extension"|"queue"|"voicemail"|"timecondition"|"hangup", id?: string }` — omitir ou `null` = Hangup()  
**TimeCondition schema:** `{ id, name, companyId, trueRoute, falseRoute, timeGroups ([{ timeGroup: { id, name } }]), createdAt, updatedAt }`  
**Nota:** Ao criar/atualizar/deletar TC, gera/regenera/remove o contexto `tc-<id>` no dialplan Asterisk (`extensions` realtime) usando `GotoIfTime` por range — OR lógico entre todos os ranges de todos os TGs vinculados

---

## Regras de negócio críticas
- `/auth/register` só funciona quando `COUNT(users) === 0`; o usuário criado é sempre `admin`
- DIDs: `UNIQUE(number, companyId)` — mesmo número pode existir em empresas diferentes
- Logout revoga via JTI no Redis, não só invalida o token localmente
- `webhookSlug` em User é UUID gerado no create, não alterável
- `extensionId` em User vincula usuário ao seu ramal — usado para autorização de pause/unpause em filas
- Delete de Company é cascade para seus DIDs
- Delete de OutboundRoute é cascade para seus OutboundDialPatterns
- OutboundRoute `position` define prioridade de matching — menor = maior prioridade
- PUT `/outbound-routes/:id/trunks` substitui a lista completa de trunks (não é aditivo)
