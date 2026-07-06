# Sofon PABX

![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Asterisk](https://img.shields.io/badge/Asterisk-Realtime%2FODBC-F68422?style=flat&logo=asterisk&logoColor=white)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey?style=flat)](LICENSE)

Backend de gerenciamento de PABX (Asterisk): provisionamento de ramais, troncos, filas, rotas de entrada/saída, condições de horário e DIDs, escrevendo diretamente nas tabelas realtime do Asterisk via banco compartilhado **por instância**.

## Escopo

**Este projeto não é um micro-SaaS multi-tenant.** É uma ferramenta de centralização de provisionamento e roteamento de chamadas para **instâncias de Asterisk isoladas, uma por VPS**, no modelo MagnusBilling: o Sofon orquestra várias instâncias via API, cada instância roda isolada com IP público e troncos próprios.

**Motivo técnico:** troncos SIP (operadoras) monitoram volume e padrão de chamadas por IP de origem para detecção de fraude/spam (CLI spoofing, robocall, SIMbox). Concentrar troncos de várias empresas distintas numa única VPS/IP:
- amplia o raio de bloqueio — tráfego anômalo de um cliente pode derrubar/blacklistar o IP pra todos os outros;
- viola limites contratuais de canais simultâneos por IP que a maioria das operadoras impõe;
- acopla o risco de fraude/compliance de clientes sem nenhuma relação entre si.

O isolamento entre empresas por sufixo `asteriskId` (ver [backend/CLAUDE.md](backend/CLAUDE.md), seção "context de Extension") só é seguro **dentro de uma única instância controlada pelo mesmo operador** — não usar como base pra hospedar clientes finais desconhecidos entre si compartilhando a mesma VPS/IP de troncos.

## Stack

- **Runtime**: [Bun](https://bun.com)
- **HTTP**: Fastify 5
- **Validação**: Zod (`fastify-type-provider-zod`)
- **Banco**: PostgreSQL via Prisma ORM (mesmo banco usado pelo Asterisk Realtime/ODBC)
- **Cache**: Redis (JTI de autenticação) + node-cache (cache de entidades em memória)
- **Auth**: JWT (HS256) — access token 15min, refresh token 7d
- **Docs**: Swagger/OpenAPI via `@fastify/swagger` + Scalar UI

## Estrutura do repositório

```
sofon-pabx/
├── backend/          # API (Fastify + Prisma)
│   ├── src/
│   │   ├── modules/      # auth, users, companies, dids, extensions,
│   │   │                 # queues, queue-members, trunks,
│   │   │                 # outbound-routes, inbound-routes,
│   │   │                 # time-groups, time-conditions
│   │   ├── asterisk/      # repositórios que escrevem nas tabelas
│   │   │                  # realtime do Asterisk (sip_peers, ps_endpoints,
│   │   │                  # queues, extensions/dialplan, etc.)
│   │   ├── middleware/    # auth + escopo multi-empresa (admin/reseller/user)
│   │   ├── config/        # env, redis, cache
│   │   └── schemas/       # respostas/erros padronizados
│   ├── prisma/            # schema e migrations
│   └── setups/            # docker-compose, scripts de instalação do Asterisk (VPS)
└── (frontend, quando existir)
```

Cada módulo do backend segue o padrão `routes → controller → service`, com schemas Zod dedicados. Ver [backend/CLAUDE.md](backend/CLAUDE.md) para detalhes de convenções, regras de negócio e schemas de API.

## Arquitetura Asterisk

O backend não fala AMI/ARI diretamente — ele escreve nas tabelas realtime (`sip_peers`, `ps_endpoints`, `ps_auths`, `ps_aors`, `queues`, `queue_members`, `extensions`/dialplan) que o Asterisk lê via ODBC. Suporta `chan_sip` (legado) e `chan_pjsip` em paralelo por compatibilidade com o mercado BR.

Isolamento entre empresas é feito por sufixo (`asteriskId`) nos identificadores (ramal, número), não por contexto Asterisk separado — todas as empresas compartilham o mesmo `extensions.conf` estático com `switch => Realtime`. Esse isolamento é lógico (dialplan/banco), não de rede/tronco — por isso vale só dentro da mesma VPS/operador (ver seção "Escopo").

## Desenvolvimento

```bash
cd backend
bun install
cp .env.example .env   # configurar DATABASE_URL, JWT_SECRET, REDIS_URL etc.
bun run dev             # http://localhost:3333 (docs em /docs)
```

Infra local (Postgres) via `backend/setups/docker-compose.yml`.

### Testes

```bash
bun run test             # unit + integration
bun run test:unit        # só *.service.test.ts (mocks, rápido)
bun run test:integration # só *.routes.test.ts (sobe app + Redis)
```

## Deploy (VPS)

Scripts de instalação do Asterisk (PJSIP/chan_sip + ODBC realtime) estão em `backend/setups/`. Ver `install-asterisk.sh` e `odbc-realtime.sh`.

## Licença

Projeto proprietário e privado — todos os direitos reservados a Rafael Rizzo. Uso, cópia ou distribuição requerem autorização explícita do autor. Ver [LICENSE](LICENSE).
