# Sofon PABX — Backend Spec

## Stack
- Runtime: Bun
- Framework: Fastify
- ORM: Prisma (PostgreSQL)
- Cache: Redis (JTI revogação)
- Auth: JWT RS256 — access 15min, refresh 7d
- Validação: Zod
- Testes: `bun run test`

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

**User schema:** `{ id, name, username, role, status, webhookSlug (uuid), createdAt, updatedAt }`  
**Create body:** `{ name, username, password }`  
**Update body:** `{ name?, username?, password? }` (min 1 campo)

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
- `type: "sip"` → `{ alias (2-6 dígitos), name, companyId, context?, ...sipFields }`
- `type: "pjsip"` → `{ alias (2-6 dígitos), name, companyId, context?, ...pjsipFields }`

**Batch body:** `{ extensions: CreateExtension[] }` — sem alias duplicado por empresa no mesmo lote  
**Update body:** `{ name }`  
**Nota:** `sip` grava em `sip_peers`; `pjsip` grava em `ps_endpoints` + `ps_aors`

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

---

### Trunks
| Método | Path | Auth | Role | Desc |
|--------|------|------|------|------|
| GET | `/trunks` | Sim | qualquer | Lista trunks |
| GET | `/trunks/:id` | Sim | qualquer | Busca por ID |
| POST | `/trunks` | Sim | qualquer | Cria trunk |
| PUT | `/trunks/:id` | Sim | qualquer | Atualiza trunk |
| DELETE | `/trunks/:id` | Sim | qualquer | Remove trunk |

**Create body (discriminatedUnion por `registrationMode`):**
- `registrationMode: "outbound"` → `{ name, companyId, type (sip|pjsip), host, username, password, context?, codecs? }`
- `registrationMode: "inbound"` → `{ name, companyId, type (sip|pjsip), host?, username?, password?, context?, codecs? }`

**Update body:** `{ host?, username?, password?, context?, codecs? }`

---

## Regras de negócio críticas
- `/auth/register` só funciona quando `COUNT(users) === 0`; o usuário criado é sempre `admin`
- DIDs: `UNIQUE(number, companyId)` — mesmo número pode existir em empresas diferentes
- Logout revoga via JTI no Redis, não só invalida o token localmente
- `webhookSlug` em User é UUID gerado no create, não alterável
- Delete de Company é cascade para seus DIDs
