# Runbook: backfill de dialplan escreve o `.conf` certo mas Asterisk não recarrega

> TL;DR: `backfill-dialplan-files.ts` mata o processo (`process.exit(0)`) antes do
> `reloadDialplan()` fire-and-forget (debounce 500ms) terminar. Arquivo em disco fica
> correto, Asterisk continua com o dialplan antigo em memória até `dialplan reload`
> manual ou até alguém editar algo pela API (processo do server, que fica vivo).

## Sintoma

Corrigido um bug de geração de dialplan (ex: nó "Ramal" em Flows usando `number`
completo em vez de `alias`, ver commit `f372a3d`), deploy feito, mas a ligação de
teste continua caindo no comportamento antigo (`Playback(pbx-invalid)` mesmo com
o ramal livre).

`asterisk -rx "dialplan show <exten>@<contexto>"` mostra o app/appdata **antigo**,
mesmo que o `.conf` em `/etc/asterisk/dialplan-extra/<contexto>/<asteriskId>.conf`
já tenha o conteúdo novo (timestamp do arquivo bate com o horário do deploy).

## Causa raiz

`entrypoint.sh` roda, nessa ordem, só em `PROCESS_ROLE != web`:

```sh
bunx prisma migrate deploy
bun dist/scripts/backfill-dialplan-files.js   # processo separado, de vida curta
exec bun dist/server.js                        # só sobe depois do backfill terminar
```

`backfill-dialplan-files.ts` chama `regenerate()` de cada repository em série. Cada
`regenerate()` grava o `.conf` (correto, síncrono) e dispara
`reloadDialplan()` (`dialplan-file.repository.ts`) - que é **fire-and-forget,
debounced em 500ms**, de propósito: CRUDs individuais via API não devem segurar a
response esperando o reload.

O backfill, porém, termina o `main()` e cai em `.finally(() => process.exit(0))`
quase imediatamente depois do último `regenerate()` - bem antes dos 500ms de
debounce + round-trip AMI (login → command → logoff) completarem. O processo
morre, a Promise pendente nunca resolve, e o `dialplan reload` via AMI
simplesmente não acontece nesse boot.

Como o container do `worker`/`all` sobe o `server.js` logo em seguida (processo
que fica vivo), o **próximo** CRUD real feito por qualquer empresa dispara um
`regenerate()` novo cujo `reloadDialplan()` dessa vez tem tempo de completar -
por isso o sintoma "some sozinho" depois de qualquer edição no dashboard, o que
mascarava a causa.

## Fix

`backfill-dialplan-files.ts` agora chama `reloadDialplanNow()` (variante
*awaited*, não debounced, já existente e usada pelo resync manual de admin) uma
única vez no fim do `main()`, antes do `process.exit(0)`. Loga se o reload via
AMI de fato confirmou (`ami.command.executed`) ou falhou (`ami.*` warn) - visível
no log do container assim que ele sobe.

## Como diagnosticar de novo

1. `docker logs <container_worker> | grep -i 'backfill\|ami\.'` - confirmar se
   "Backfill concluído. Dialplan reload via AMI: ok" apareceu.
2. Se não: `ssh` na VPS, `asterisk -rx "dialplan show <exten>@<contexto>"` e
   comparar com o `.conf` em disco (`cat /etc/asterisk/dialplan-extra/<contexto>/<asteriskId>.conf`)
   - arquivo novo + dialplan em memória velho = mesma causa.
3. Mitigação imediata sem esperar outro deploy: `asterisk -rx "dialplan reload"`
   direto na VPS.
