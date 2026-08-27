# Sofon PABX - Spec-Driven Tracker

## Escopo (não-negociável)

**Não é micro-SaaS multi-tenant.** É centralização de provisionamento e roteamento de chamadas pra **instâncias de Asterisk isoladas, uma por VPS** (modelo MagnusBilling) - o Sofon orquestra várias instâncias via API, nunca concentra o tráfego/troncos de várias empresas numa única VPS/IP.

**Motivo:** operadoras monitoram volume/padrão de chamadas por IP pra detecção de fraude (CLI spoofing, robocall, SIMbox). Um único IP com troncos de N empresas: amplia o raio de bloqueio (uma empresa com tráfego anômalo derruba o IP de todas), viola limite contratual de canais simultâneos por IP, e acopla risco de compliance entre clientes sem relação entre si. Ver seção "Escopo" do [README.md](../README.md) raiz.

Qualquer feature/spec daqui pra frente deve assumir esse modelo - isolamento lógico (`asteriskId`) dentro da mesma VPS é válido, isolamento de tenants desconhecidos numa VPS compartilhada não é.

## Status legend
- `[x]` implementado e testado
- `[~]` implementado, sem testes
- `[ ]` pendente

---

## Módulos

### Health
| Status | Método | Rota |
|--------|--------|------|
| `[x]` | GET | `/health` |

---

### Auth
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | POST | `/auth/register` | register |
| `[x]` | POST | `/auth/login` | login |
| `[x]` | POST | `/auth/refresh` | refresh |
| `[x]` | POST | `/auth/logout` | logout |

Testes: `auth.routes.test.ts`, `auth.service.test.ts`

---

### Users
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | GET | `/users` | getAllUsers |
| `[x]` | GET | `/users/:id` | getUserById |
| `[x]` | GET | `/users/:id/companies` | getCompaniesByUser |
| `[x]` | POST | `/users` | createUser |
| `[x]` | PUT | `/users/:id` | updateUser |
| `[x]` | DELETE | `/users/:id` | deleteUser |

Testes: `users.routes.test.ts`, `users.service.test.ts`

---

### Companies
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | GET | `/companies` | getAllCompanies |
| `[x]` | GET | `/companies/:id` | getCompanyById |
| `[x]` | GET | `/companies/users/:id_user` | getCompaniesByUser |
| `[x]` | POST | `/companies` | createCompany |
| `[x]` | PUT | `/companies/:id` | updateCompany |
| `[x]` | DELETE | `/companies/:id` | deleteCompany |

Testes: `companies.routes.test.ts`, `companies.service.test.ts`

---

### DIDs
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | GET | `/dids` | getDids |
| `[x]` | GET | `/dids/:id` | getDidById |
| `[x]` | GET | `/dids/company/:id_company` | getDidsByCompanyId |
| `[x]` | POST | `/dids` | createDid |
| `[x]` | PUT | `/dids/:id` | updateDid |
| `[x]` | DELETE | `/dids/:id` | deleteDid |

Testes: `dids.routes.test.ts`, `dids.service.test.ts`

---

### Extensions
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | GET | `/extensions?companyId=` | getAllExtensions |
| `[x]` | GET | `/extensions/:id` | getExtensionById |
| `[x]` | POST | `/extensions` | createExtension |
| `[x]` | POST | `/extensions/batch` | createExtensionBatch |
| `[x]` | PUT | `/extensions/:id` | updateExtension |
| `[x]` | PATCH | `/extensions/:id/password` | resetExtensionPassword |
| `[x]` | DELETE | `/extensions/:id` | deleteExtension |

Testes: `extensions.routes.test.ts`, `extensions.service.test.ts`

---

### Queues
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[x]` | GET | `/queues` | getQueues |
| `[x]` | GET | `/queues/company/:id_company` | getQueuesByCompanyId |
| `[x]` | GET | `/queues/:id` | getQueueById |
| `[x]` | GET | `/queues/:id/members` | getQueueMembers |
| `[x]` | POST | `/queues` | createQueue |
| `[x]` | POST | `/queues/:id/members` | addMember |
| `[x]` | PUT | `/queues/:id` | updateQueue |
| `[x]` | PUT | `/queues/:id/members/:memberId` | updateMember |
| `[x]` | DELETE | `/queues/:id` | deleteQueue |
| `[x]` | DELETE | `/queues/:id/members/:memberId` | removeMember |

Testes: `queues.routes.test.ts`, `queues.service.test.ts`

---

### Trunks
| Status | Método | Rota | Handler |
|--------|--------|------|---------|
| `[~]` | GET | `/trunks?companyId=` | getTrunks |
| `[~]` | GET | `/trunks/:id` | getTrunkById |
| `[~]` | POST | `/trunks` | createTrunk |
| `[~]` | PUT | `/trunks/:id` | updateTrunk |
| `[~]` | DELETE | `/trunks/:id` | deleteTrunk |

Testes: **ausentes** - criar `trunks/__tests__/trunks.routes.test.ts` e `trunks.service.test.ts`

#### Gaps vs spec
- `GET /trunks` requer `?companyId=` obrigatório; spec descreve comportamento admin-sees-all (como os outros módulos). Avaliar se alinha ou se é intencional usar query explícita.

---

## Pendências globais

- [ ] Testes do módulo Trunks
- [ ] Confirmar comportamento de `GET /trunks` (scope automático vs query obrigatória)

---

## Setup SQL (Asterisk DB)

```sql
-- docker exec -it postgres_sofon psql -U postgres

-- \c asterisk

ALTER TABLE extensions OWNER TO asterisk;
ALTER TABLE ps_aors OWNER TO asterisk;
ALTER TABLE ps_auths OWNER TO asterisk;
ALTER TABLE ps_contacts OWNER TO asterisk;
ALTER TABLE ps_endpoints OWNER TO asterisk;
ALTER TABLE ps_registrations OWNER TO asterisk;
ALTER TABLE ps_identifies    OWNER TO asterisk;
ALTER TABLE sip_peers OWNER TO asterisk;
ALTER TABLE voicemail_users OWNER TO asterisk;
ALTER TABLE queues OWNER TO asterisk;
ALTER TABLE queue_members OWNER TO asterisk;
```

```sql docker exec -it postgres_sofon psql -U postgres -d asterisk -c "
GRANT USAGE ON SCHEMA public TO asterisk;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO asterisk;
"
```
