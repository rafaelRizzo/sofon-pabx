#!/bin/sh
set -e

bunx prisma migrate deploy

exec bun dist/server.js
