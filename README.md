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
│   │   │                 # time-groups, time-conditions, callcenter, ...
│   │   ├── asterisk/      # repositórios que escrevem nas tabelas
│   │   │                  # realtime do Asterisk (sip_peers, ps_endpoints,
│   │   │                  # queues, extensions/dialplan, etc.)
│   │   ├── middleware/    # auth + escopo multi-empresa (admin/reseller/user)
│   │   ├── config/        # env, redis, cache
│   │   └── schemas/       # respostas/erros padronizados
│   ├── prisma/            # schema e migrations
│   ├── Dockerfile, docker-compose.yml, entrypoint.sh  # imagem de produção (backend + Postgres)
│   └── setups/            # docker-compose (Postgres p/ dev), scripts de instalação do
│                           # Asterisk e do Realtime/ODBC (VPS)
└── frontend/         # Next.js (App Router) — dashboard
    ├── app/, components/, hooks/, lib/
    └── Dockerfile, docker-compose.yml  # imagem de produção
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

Modelo: **uma VPS por instância** (ver "Escopo"). Nela convivem 3 mundos diferentes — Asterisk nativo (compilado do fonte, fora do Docker), backend/frontend/Postgres em containers, e um reverse proxy (Nginx Proxy Manager) que termina TLS e expõe tudo por domínio.

### Pré-requisitos

- VPS Debian 11+/Ubuntu 24.04+, acesso root, IP público
- Docker + Docker Compose plugin instalados
- Portas liberadas no firewall do provedor (cloud/security group) — o firewall interno (`nftables`) já é configurado pelo instalador do Asterisk (passo 2):
  - `22`, `21122` — SSH
  - `80`, `443` — HTTP/HTTPS (proxy + emissão de certificado ACME)
  - `81` — painel do Nginx Proxy Manager
  - `5060`-`5062` — SIP/PJSIP (liberado só por IP via whitelist, ver `manage-fw` no fim desta seção)
  - `10000-20000/udp` — RTP (mesma whitelist)

### 1. Rede Docker compartilhada

```bash
docker network create proxy
```

Backend, frontend e Nginx Proxy Manager referenciam essa rede `proxy` como `external: true` nos respectivos `docker-compose.yml`. O backend roda em `network_mode: host` (precisa falar com Asterisk/Postgres em `127.0.0.1`), então não entra nessa rede — ver nota no passo 7.

### 2. Asterisk (nativo, fora do Docker)

```bash
cd backend/setups
sudo ./install-asterisk.sh
```

Compila e instala o Asterisk, configura PJSIP (+ `chan_sip` legado se você escolher), aplica o firewall (`nftables`) e o Fail2Ban, gera as credenciais do AMI (**anote o `AMI_SECRET`** exibido no resumo final) e cria os diretórios que o backend vai montar como volume (`/etc/asterisk/dialplan-extra`, `/var/lib/asterisk/sounds`).

### 3. Nginx Proxy Manager

```yaml
# ~/nginx-proxy/docker-compose.yml
services:
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: npm
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    environment:
      - DB_SQLITE_FILE=/data/database.sqlite
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - proxy

networks:
  proxy:
    external: true
```

```bash
docker compose up -d
```

Painel em `http://<ip-da-vps>:81` — trocar o login/senha padrão no primeiro acesso.

### 4. Backend + Postgres

```bash
cd backend
cp .env.example .env
# editar .env: JWT_SECRET/REFRESH_SECRET (>=32 chars, distintos entre si), AMI_SECRET (passo 2),
# CORS_ORIGIN (domínio do frontend) — demais defaults servem
docker compose up -d --build
```

- Sobe `postgres` (porta `5433` publicada no host) e `backend` (`network_mode: host`).
- `entrypoint.sh` roda `prisma migrate deploy` automaticamente antes de subir o server — não precisa migration manual.
- Monta os volumes criados no passo 2 (`dialplan-extra`, `sounds`) — é assim que o backend materializa dialplan estático (timeconditions/ivrs/announcements/filas/etc., ver `backend/CLAUDE.md`).

### 5. Conectar Asterisk ↔ Postgres (Realtime/ODBC)

```bash
cd backend/setups
sudo ./odbc-realtime.sh
```

Rodar **depois** do passo 4 (as tabelas já existem via `prisma migrate deploy`). Cria o usuário `asterisk` no Postgres com os grants necessários, configura o DSN ODBC e `extconfig.conf`/`sorcery.conf`/`cdr_adaptive_odbc.conf`, e reinicia o Asterisk. Ao final, validar:

```bash
asterisk -rx 'odbc show all'
asterisk -rx 'pjsip show endpoints'
```

### 6. Frontend

```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=https://api.seudominio.com" > .env
docker compose up -d --build
```

Sobe na rede `proxy`, porta `3000` interna (não publicada no host — só alcançável via a rede Docker).

### 7. Nginx Proxy Manager — Proxy Hosts

No painel (`:81`), criar 2 Proxy Hosts com SSL (Let's Encrypt):

| Domínio | Forward Hostname/IP | Porta | Observação |
|---|---|---|---|
| `app.seudominio.com` | `frontend` | `3000` | mesma rede Docker `proxy`, resolve pelo nome do service |
| `api.seudominio.com` | gateway da rede `proxy` (`docker network inspect proxy --format '{{(index .IPAM.Config 0).Gateway}}'`, tipicamente `172.18.0.1`) | `3333` | backend está em `network_mode: host`, sem nome de service — o `nftables` do passo 2 já libera essa faixa privada pra porta `3333` |

### 8. Primeiro acesso

```bash
curl -X POST https://api.seudominio.com/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","username":"admin@empresa.com","password":"senha-forte"}'
```

Só funciona uma vez (enquanto `COUNT(users) === 0`) e sempre cria o primeiro usuário como `admin`. A partir daí, login pelo frontend (`app.seudominio.com`) e provisionar na ordem: Company → Extensions/Trunks/DIDs → Inbound/Outbound Routes → Queues. Docs interativas da API em `https://api.seudominio.com/docs`.

### Liberar IPs de troncos/ramais remotos

```bash
sudo manage-fw add 1.2.3.4     # libera IP nas portas SIP/PJSIP/RTP (nftables + Fail2Ban)
sudo manage-fw list            # whitelist atual + banidos
```

## Licença

Projeto proprietário e privado — todos os direitos reservados a Rafael Rizzo. Uso, cópia ou distribuição requerem autorização explícita do autor. Ver [LICENSE](LICENSE).
