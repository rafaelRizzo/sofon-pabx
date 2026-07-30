#!/bin/bash
# ============================================================
# ADD-ON SOFON PBX v1.0 - CODEC G.729 (bcg729, open-source)
# Requer: Asterisk já instalado via install-asterisk.sh
# (fonte extraída ainda presente em /usr/src/asterisk-<versao>)
# ============================================================
#
# Patentes do G.729/G.729A expiraram em nov/2016 (ITU + Sipro/G.729
# Consortium) — bcg729 é GPLv3, sem custo de licenciamento hoje.
# https://github.com/BelledonneCommunications/bcg729
#
# Instala só o módulo codec_g729.so em /usr/lib/asterisk/modules.
# Não mexe em pjsip.conf/iax.conf/dialplan — teste isolado antes
# de liberar "g729" no allow= de algum endpoint via painel.

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

readonly BCG729_REPO="https://github.com/BelledonneCommunications/bcg729.git"
readonly G72X_REPO="https://github.com/arkadijs/asterisk-g72x.git"
LOG_FILE="/var/log/sofon-install-g729.log"

log()  { echo -e "${GREEN}[+]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Execute como root: sudo $0"
touch "$LOG_FILE"

echo ""
echo -e "${BOLD}Add-on G.729 (bcg729) - Sofon PBX${NC}"
echo ""

# ============================================================
# STEP 1 - LOCALIZAR SOURCE DO ASTERISK (headers)
# ============================================================
command -v asterisk >/dev/null 2>&1 || err "Asterisk não encontrado. Rode install-asterisk.sh primeiro."

ASTERISK_FULL_VERSION=$(asterisk -V 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
[[ -z "$ASTERISK_FULL_VERSION" ]] && err "Não consegui detectar a versão do Asterisk rodando."

ASTERISK_SRC="/usr/src/asterisk-${ASTERISK_FULL_VERSION}"
[[ -d "$ASTERISK_SRC/include/asterisk" ]] || err "Headers não encontrados em ${ASTERISK_SRC}/include — a source do Asterisk foi apagada. Recompile o Asterisk (install-asterisk.sh) sem limpar /usr/src depois."

log "Asterisk ${ASTERISK_FULL_VERSION} detectado, headers em ${ASTERISK_SRC}/include"

# ============================================================
# STEP 2 - DEPENDÊNCIAS DE BUILD
# ============================================================
log "Instalando dependências de build"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    git cmake build-essential autoconf automake libtool pkg-config \
    >> "$LOG_FILE" 2>&1 || err "Falha nas dependências"

# ============================================================
# STEP 3 - BCG729 (lib G.729, CMake)
# ============================================================
log "Compilando bcg729"
cd /usr/src
[[ -d bcg729 ]] && rm -rf bcg729
git clone --depth 1 "$BCG729_REPO" bcg729 >> "$LOG_FILE" 2>&1 || err "Falha ao clonar bcg729"
cd bcg729
cmake . -DCMAKE_INSTALL_PREFIX=/usr/local -DCMAKE_SKIP_INSTALL_RPATH=ON >> "$LOG_FILE" 2>&1 || err "Falha no cmake do bcg729"
make -j"$(nproc)" >> "$LOG_FILE" 2>&1 || err "Falha ao compilar bcg729"
make install >> "$LOG_FILE" 2>&1 || err "Falha ao instalar bcg729"
ldconfig
log "bcg729 instalado (/usr/local/lib)"

# ============================================================
# STEP 4 - MÓDULO codec_g729.so (asterisk-g72x)
# ============================================================
log "Compilando módulo codec_g729"
cd /usr/src
[[ -d asterisk-g72x ]] && rm -rf asterisk-g72x
git clone --depth 1 "$G72X_REPO" asterisk-g72x >> "$LOG_FILE" 2>&1 || err "Falha ao clonar asterisk-g72x"
cd asterisk-g72x
./autogen.sh >> "$LOG_FILE" 2>&1 || err "Falha no autogen.sh"
./configure --with-bcg729 --with-asterisk-includes="${ASTERISK_SRC}/include" \
    >> "$LOG_FILE" 2>&1 || err "Falha no configure do codec_g729"
make -j"$(nproc)" >> "$LOG_FILE" 2>&1 || err "Falha ao compilar codec_g729"
make install >> "$LOG_FILE" 2>&1 || err "Falha ao instalar codec_g729"

MODULE_PATH="/usr/lib/asterisk/modules/codec_g729.so"
[[ -f "$MODULE_PATH" ]] || err "Build terminou mas ${MODULE_PATH} não apareceu — veja $LOG_FILE"
log "Módulo instalado: ${MODULE_PATH}"

# ============================================================
# STEP 5 - CARREGAR NO ASTERISK RODANDO
# ============================================================
asterisk -rx "module load codec_g729.so" >> "$LOG_FILE" 2>&1 || warn "Não consegui carregar via AMI/CLI — reinicie o Asterisk manualmente"
sleep 1
if asterisk -rx "core show translation" 2>/dev/null | grep -qi g729; then
    log "codec_g729 carregado e ativo"
else
    warn "Módulo instalado mas não confirmado ativo — rode: asterisk -rx 'module show like g729'"
fi

echo ""
echo -e "${BOLD}Concluído.${NC} Pra testar:"
echo "  1. asterisk -rx 'module show like g729'  (confirma módulo carregado)"
echo "  2. No painel, adicione 'g729' no campo Codecs do ramal/trunk de teste"
echo "  3. Faça uma chamada de teste e confira com: asterisk -rx 'core show channel <canal>'"
echo ""
echo -e "${YELLOW}Nota:${NC} bcg729 é implementação em software (sem aceleração IPP)."
echo "Em VPS com poucos vCPUs, muitos canais G.729 simultâneos podem pesar CPU."
echo ""
