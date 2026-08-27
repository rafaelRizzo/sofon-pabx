#!/bin/sh
set -e

# Réplicas 'web' não rodam migration - evita N containers competindo pelo mesmo migrate deploy
# ao subir juntos; quem migra é sempre o worker (singleton) ou o modo 'all' (dev/single-instance)
if [ "$PROCESS_ROLE" != "web" ]; then
    bunx prisma migrate deploy
fi

exec bun dist/server.js
