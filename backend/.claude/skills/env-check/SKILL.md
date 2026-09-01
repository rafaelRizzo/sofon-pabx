---
name: env-check
description: Confere backend/.env contra backend/.env.example antes de rodar dev/build (chave faltando, placeholder não trocado). Use antes de bun run dev, ou quando o usuário reportar erro de env var.
---

# env-check

Evita o clássico "esqueci de configurar X" só descoberto em runtime. Nunca imprime valor de segredo, só nome de chave e se está ok/faltando/placeholder.

## Passo a passo

1. Se `backend/.env` não existir: copiar de `backend/.env.example` e avisar o usuário que precisa preencher os valores antes de continuar (nunca inventar um valor plausível pra `DATABASE_URL`/`REDIS_PASSWORD`/segredo de produção, só copiar o placeholder).

2. Comparar as **chaves** (não os valores) de `.env` contra `.env.example`:
   - Chave em `.env.example` faltando em `.env`, reportar como bloqueante.
   - Chave em `.env` que não existe em `.env.example`, reportar como aviso.

3. Checar placeholder não trocado em produção (mesma regra que `src/config/env.ts` valida em `NODE_ENV=production`):
   - `JWT_SECRET`/`REFRESH_SECRET`/`ENCRYPTION_MASTER_KEY` com o valor literal do `.env.example` (`...-change-in-production`), com menos de 32 caracteres, ou começando com `"your-"`: bloqueante em produção (o boot do `env.ts` já falha sozinho nesse caso), aviso em dev. `JWT_SECRET` e `REFRESH_SECRET` também precisam ser **diferentes um do outro** — reportar se estiverem iguais. Sugerir `openssl rand -hex 32` pra gerar, mas não gerar o valor sozinho e escrever no `.env` sem o usuário pedir.
   - `REDIS_PASSWORD=change-this-redis-password` ainda presente: mesmo tratamento.
   - `DATABASE_URL` com credencial default (`user:password@localhost`) é aceitável em dev local, reportar como "não usar em produção" se o usuário mencionar deploy.

4. Conferir consistência de grupos de variáveis relacionadas (chave presente sozinha sem o resto do grupo costuma ser esquecimento, não intencional):
   - `AGI_HOST`/`AGI_PORT` (FastAGI, `src/asterisk/agi-server.ts`).
   - `AMI_HOST`/`AMI_PORT`/`AMI_USER`/`AMI_SECRET` (AMI, `src/asterisk/ami-client.ts`) — `AMI_SECRET` é gerado pelo `install-asterisk.sh` na VPS e precisa ser copiado manualmente, indefinido só gera warning (reload via AMI pulado), não bloqueia a API.
   - `ASTERISK_VERSION`/`SIP_LEGACY_ENABLED`/`SIP_PORT`/`PJSIP_PORT` (espelham a escolha do `install-asterisk.sh`, expostos via `GET /system/sip-config`).
   - `ELEVENLABS_API_URL`/`ELEVENLABS_MODEL_ID`/`ELEVENLABS_TIMEOUT_MS` (config não-secreta compartilhada do TTS — a API key em si é por empresa, `Company.elevenLabsApiKey`, não fica no `.env`).
   - `AUDIO_UPLOAD_RATE_LIMIT_MAX`/`WINDOW` + `AUDIO_CONVERSION_CONCURRENCY`/`QUEUE_MAX`/`TIMEOUT_MS`.
   - `DIALPLAN_EXTRA_DIR` — em dev/test sem Asterisk instalado, deve apontar pra um path local (não o real `/etc/asterisk/dialplan-extra`), reportar se um ambiente de teste estiver usando o path de produção.

5. `PROCESS_ROLE` (`web`/`worker`/`all`) presente e com valor válido — `web` não roda `prisma migrate deploy` no `entrypoint.sh` nem o `worker` de AGI/AMI/jobs, então um valor errado aqui silenciosamente desliga metade do sistema sem erro explícito.

6. Nunca imprimir o valor de `JWT_SECRET`/`REFRESH_SECRET`/`ENCRYPTION_MASTER_KEY`/`REDIS_PASSWORD`/`AMI_SECRET`/`DATABASE_URL` no chat ou em log, só se a chave está presente, ausente, ou igual ao placeholder.

7. Reporte final: lista de chave por status (ok / faltando / placeholder não trocado / chave extra não documentada / grupo incompleto). Se tudo ok, uma frase confirmando e parar.
