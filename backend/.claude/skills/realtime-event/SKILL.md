---
name: realtime-event
description: Adiciona um evento/estado novo ao pipeline de realtime AMI (backend/src/asterisk/transport/ami-events.ts) que alimenta o SSE de extensions/trunks/queues. Use quando o usuário pedir pra refletir um evento do Asterisk ao vivo (ex: "mostra quando o ramal está mudo", "preciso saber quando a chamada fica em hold") ou um estado novo no dashboard de monitoramento.
---

# realtime-event

Todo o pipeline vive em `backend/src/asterisk/transport/ami-events.ts` (conexão AMI persistente, singleton, `Events: on`) + `realtime-keys.ts` (chaves Redis) + `realtime-bus.ts` (dispara o SSE). Não é CRUD — não usar a skill `new-module` aqui.

## Passo a passo

1. **Confirmar o evento de verdade**, não assumir por documentação genérica do Asterisk. Setar `AMI_DEBUG=true` no `.env` e observar os blocos brutos logados (`ami.debug.message`, dentro de `ami-events.ts`) contra o Asterisk real do projeto — os nomes de campo já variam entre versões/dialetos (comentários no arquivo citam "confirmado via AMI_DEBUG contra Asterisk 22.7/real"). Não escrever o handler antes de ver o campo existir de fato no bloco.

2. **Escrever o handler**: `async function handle<Evento>(block: AmiBlock): Promise<void>`, seguindo o padrão dos handlers existentes no mesmo arquivo (ex: `handleQueueCallerAbandon`, `handlePeerStatus`). Ler os campos direto de `block` (tipo `AmiBlock` de `ami-events.parser.ts`), escrever no Redis via `redisClient` usando uma chave de `realtime-keys.ts` — reaproveitar uma existente (`extKey`, `trunkKey`, `queueMembersKey`, etc.) ou adicionar uma nova `<algo>Key()` lá se for um dado novo, sempre com `expire()`/TTL: `STATUS_TTL_SECONDS` (presence), `CALL_TTL_SECONDS` (chamada ativa) ou `HOLDTIME_TTL_SECONDS` (métrica agregada) conforme o tipo de dado — nunca gravar sem TTL (é a rede de segurança contra estado "fantasma" se o AMI cair sem reconectar).
   - **Nunca deixar o handler lançar.** O chamador (bloco `try` em torno da leitura de socket, próximo a `ami.events.handler.failed`) já engole qualquer exceção e só loga `warn` — mas uma exceção não tratada dentro do handler ainda corta a execução do resto daquele handler no meio, então tratar erro de parsing (`block.Campo` ausente/malformado) com early return, não com throw.

3. **Registrar no switch**: adicionar `case '<Evento>': return handle<Evento>(block)` dentro de `routeEvent` (função no mesmo arquivo, comentário logo acima: "Qualquer evento fora desta lista é ignorado de propósito — não modelar every single Asterisk event"). Só adicionar o que for realmente consumido por alguma feature — não registrar eventos "pra garantir".

4. **Emitir a mudança**: chamar `emitRealtimeChange('extension' | 'trunk' | 'queue')` (import de `./realtime-bus`) ao final do handler, só quando o estado realmente mudou. Isso é o que acorda o SSE em `src/modules/realtime/realtime.sse.ts` — o coalescing de rajadas (debounce de 300ms) já existe lá, não duplicar debounce dentro do handler. Se o handler processa uma lista inteira de itens (ex: hydrate de snapshot), emitir uma vez só no final do loop, não por item.

5. **Sem evento nativo confiável?** Alguns estados do Asterisk (registro outbound PJSIP, endpoint sem `qualify_frequency`, canais realmente ativos após reconexão) não disparam evento de mudança — só dá pra saber reconsultando. Nesse caso, seguir o padrão de poll já existente: uma constante `<NOME>_POLL_MS` no topo do arquivo com comentário explicando por que não há evento nativo, um `let <nome>PollTimer: ReturnType<typeof setInterval> | undefined`, e o `setInterval` registrado dentro de `requestSnapshot()` guardado por `if (loggedIn)`. Nunca usar intervalo menor que 30s sem justificar — é polling contra o Asterisk real, não uma query em memória.

6. **Expor pro frontend**:
   - Campo novo dentro de um recurso já existente (extension/trunk/queue): estender `src/modules/realtime/schemas/realtime.schema.ts` (schema Zod de resposta) e o hook correspondente em `frontend/src/hooks/use-realtime.ts` (ver `frontend/CLAUDE.md`, seção Realtime) — os dois devem ficar espelhados manualmente, mesmo risco de drift do contrato normal da API.
   - Recurso novo (não é extension/trunk/queue): decisão maior — avaliar se precisa de rota SSE própria (padrão em `src/modules/realtime/realtime.routes.ts` + `realtime.sse.ts`). Discutir com o usuário antes de criar uma stream nova.

7. **Validar**: rodar `bunx tsc --noEmit` (agent `build-checker`). Este arquivo não tem teste unit hoje — protocolo AMI via socket TCP cru, mesma limitação já documentada em `backend/CLAUDE.md` pros handlers AGI (`handleQueueRoute`/`handleQueueSurvey`). Não inventar um teste que mocke o socket; validar manualmente contra Asterisk real (com `AMI_DEBUG=true`) se a mudança for arriscada.

## Nunca

- Nunca deixar um handler de evento lançar exceção sem tratamento — trate campo ausente/malformado com early return.
- Nunca adicionar `case` no switch de `routeEvent` sem uma feature real consumindo o evento — o comentário no código já avisa contra modelar "every single Asterisk event".
- Nunca reduzir um intervalo de poll existente pra "resolver" uma latência percebida sem antes confirmar que não existe evento nativo pro dado — cada poll no arquivo já documenta, em comentário, por que foi necessário.
- Nunca gravar estado no Redis sem TTL — é o que evita ramal/chamada "fantasma" se o AMI cair sem reconectar.
