#!/bin/bash
# ============================================================
# SOFON PBX - Ensure External Resources
# Garante que os volumes/networks external:true do backend/docker-compose.yml
# existem antes do deploy - roda no host, nao no container (Docker nao tem
# hook nativo pra isso). Idempotente: nao falha se ja existir.
#
# dokploy-network fica de fora de proposito: e criada/gerenciada pelo
# proprio Dokploy (compartilhada por toda a instancia), nao e um recurso
# deste projeto.
#
# Uso no Dokploy: colar como "Pre-deploy Command" do servico Compose
# do backend. Uso manual: bash ensure-external-resources.sh
# ============================================================

set -euo pipefail

VOLUMES=(
    postgres_sofon_data
    redis_sofon_data
    avatars_sofon_data
)

NETWORKS=(
    sofon-agi-bridge
)

for volume in "${VOLUMES[@]}"; do
    if docker volume inspect "$volume" >/dev/null 2>&1; then
        echo "[ensure-external-resources] volume $volume ja existe, pulando"
    else
        docker volume create "$volume" >/dev/null
        echo "[ensure-external-resources] volume $volume criado"
    fi
done

for network in "${NETWORKS[@]}"; do
    if docker network inspect "$network" >/dev/null 2>&1; then
        echo "[ensure-external-resources] network $network ja existe, pulando"
    else
        docker network create --driver bridge "$network" >/dev/null
        echo "[ensure-external-resources] network $network criada"
    fi
done
