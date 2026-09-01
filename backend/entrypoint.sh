#!/bin/sh
set -e

# Réplicas 'web' não rodam migration nem backfill de dialplan - evita N containers competindo
# pelo mesmo migrate deploy / reescrevendo os mesmos .conf em paralelo (lock de dialplan é só
# em memória do processo, não distribuído entre containers, ver dialplan-file.repository.ts) ao
# subir juntos; quem faz isso é sempre o worker (singleton) ou o modo 'all' (dev/single-instance)
if [ "$PROCESS_ROLE" != "web" ]; then
    bunx prisma migrate deploy
    # Reescreve todo dialplan-extra/** a partir do banco - autocura depois de reinstalação do
    # Asterisk (apaga dialplan-extra/ mas mantém o banco) e aplica automaticamente qualquer fix
    # no *gerador* de dialplan (buildDialplan/regenerate) que não seja migration de schema
    bun dist/scripts/backfill-dialplan-files.js
fi

exec bun dist/server.js
