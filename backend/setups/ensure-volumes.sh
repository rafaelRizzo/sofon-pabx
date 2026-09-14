#!/bin/bash
# ============================================================
# SOFON PBX - Ensure External Volumes
# Garante que os volumes external:true do backend/docker-compose.yml
# existem antes do deploy - roda no host, nao no container (Docker
# nao tem hook nativo pra isso). Idempotente: nao falha se ja existir.
#
# Uso no Dokploy: colar como "Pre-deploy Command" do servico Compose
# do backend. Uso manual: bash ensure-volumes.sh
# ============================================================

set -euo pipefail

VOLUMES=(
    postgres_sofon_data
    redis_sofon_data
    avatars_sofon_data
)

for volume in "${VOLUMES[@]}"; do
    if docker volume inspect "$volume" >/dev/null 2>&1; then
        echo "[ensure-volumes] $volume ja existe, pulando"
    else
        docker volume create "$volume" >/dev/null
        echo "[ensure-volumes] $volume criado"
    fi
done
