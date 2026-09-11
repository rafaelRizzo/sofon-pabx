#!/bin/bash
# ============================================================
# INSTALADOR SOFON PBX v7.14 - PJSIP + IAX2 (sem Docker, sem chan_sip)
# Debian 11+ | Ubuntu 24.04+ | Asterisk 22.7.0 LTS
# ============================================================

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

readonly ASTERISK_VERSION="22.10.1"
readonly PJSIP_PORT=5060
readonly IAX_PORT=4569
# WebRTC (softphone no browser via SIP.js) - sinalização SIP sobre WebSocket, sem TLS por enquanto
# (sem domínio/certificado ainda). Servida pelo HTTP embutido do próprio Asterisk (res_http_websocket),
# path fixo /ws. Upgrade futuro pra wss (quando houver domínio) é só trocar WS_SCHEME no .env do
# backend + adicionar [transport-wss]/tls aqui - sem tocar no resto.
readonly WS_PORT=8088
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_ADDRESS=""
LOCAL_NET=""
OS_NAME=""
OS_VERSION=""
LOG_FILE="/var/log/sofon-install.log"
SYSTEM_USER_AGENT="Sofon"

# ============================================================
# HELPERS
# ============================================================
log()      { echo -e "${GREEN}[+]${NC} $1" | tee -a "$LOG_FILE"; }
warn()     { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
err()      { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }
run()      { "$@" >> "$LOG_FILE" 2>&1 || err "Falhou: $*"; }

show_header() {
    clear
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}INSTALADOR SOFON PBX v7.12 - PJSIP + IAX2${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo ""
}

show_progress() {
    local step=$1 total=$2 message=$3
    local percent=$((step * 100 / total))
    local filled=$((percent / 2))
    echo ""
    echo -e "${BOLD}[${step}/${total}]${NC} ${message}"
    printf "["
    printf "${GREEN}%${filled}s${NC}" | tr ' ' '='
    printf "%$((50 - filled))s" | tr ' ' '-'
    printf "] ${percent}%%\n"
    echo ""
}

# ============================================================
# DETECÇÃO
# ============================================================
detect_os() {
    [[ -f /etc/os-release ]] && . /etc/os-release || err "SO não detectado"
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
}

validate_ip() {
    local ip=$1
    [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || return 1
    IFS='.' read -ra A <<< "$ip"
    for i in "${A[@]}"; do [[ $i -le 255 ]] || return 1; done
    return 0
}

detect_public_ip() {
    for s in ifconfig.me api.ipify.org icanhazip.com; do
        local ip; ip=$(curl -4 -s --max-time 5 "$s" 2>/dev/null | tr -d '\n')
        validate_ip "$ip" && echo "$ip" && return 0
    done
    return 1
}

detect_local_net() {
    local iface; iface=$(ip route | grep default | awk '{print $5}' | head -n1)
    [[ -z "$iface" ]] && echo "192.168.0.0/16" && return
    local ip; ip=$(ip addr show "$iface" | grep "inet " | awk '{print $2}' | cut -d/ -f1 | head -n1)
    if [[ $ip =~ ^10\. ]] || [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || [[ $ip =~ ^192\.168\. ]]; then
        echo "${ip%.*}.0/24"
    else
        echo "192.168.0.0/16"
    fi
}

# ============================================================
# PRÉ-CHECKS
# ============================================================
[[ $EUID -eq 0 ]] || err "Execute como root: sudo $0"
touch "$LOG_FILE"
detect_os
show_header

echo -e "${BOLD}Sistema Detectado:${NC} ${OS_NAME} ${OS_VERSION}"
echo ""

[[ "$OS_NAME" =~ Ubuntu|Debian ]] || err "SO não suportado. Use Ubuntu 24.04+ ou Debian 11+"
[[ "$OS_NAME" =~ Ubuntu ]] && [[ "${OS_VERSION%%.*}" -lt 24 ]] && err "Ubuntu 24.04+ necessário"
[[ "$OS_NAME" =~ Debian ]] && [[ "${OS_VERSION%%.*}" -lt 11 ]] && err "Debian 11+ necessário"

available_mb=$(df /usr/src | tail -1 | awk '{print int($4/1024)}')
[[ $available_mb -ge 2048 ]] || err "Espaço insuficiente: ${available_mb}MB (necessário 2GB)"
echo -e "  ${GREEN}✓${NC} Sistema compatível (${available_mb}MB livres)"
echo ""
echo -e "  ${GREEN}✓${NC} Asterisk ${ASTERISK_VERSION} (LTS) - PJSIP (porta ${PJSIP_PORT}) + IAX2 (porta ${IAX_PORT})"
echo ""
sleep 1

# ============================================================
# CONFIGURAÇÃO DE REDE
# ============================================================
show_header
echo -e "${BOLD}CONFIGURAÇÃO DE REDE${NC}"
echo ""

DETECTED_IP=$(detect_public_ip || true)
if [[ -n "$DETECTED_IP" ]]; then
    echo -e "  ${GREEN}✓${NC} IP detectado: ${DETECTED_IP}"
    echo -ne "  Usar este IP? [S/n]: "
    read -r REPLY
    [[ $REPLY =~ ^[Nn]$ ]] && { echo -ne "${CYAN}→${NC} Digite o IP/domínio: "; read -r PUBLIC_ADDRESS; } || PUBLIC_ADDRESS=$DETECTED_IP
else
    warn "IP não detectado automaticamente"
    echo -ne "${CYAN}→${NC} Digite o IP/domínio: "
    read -r PUBLIC_ADDRESS
fi

[[ -z "$PUBLIC_ADDRESS" ]] && err "IP/domínio obrigatório"
LOCAL_NET=$(detect_local_net)
echo -e "  ${GREEN}✓${NC} Rede local detectada: ${LOCAL_NET}"
echo ""
echo -ne "${CYAN}→${NC} User-Agent SIP [${SYSTEM_USER_AGENT}]: "
read -r REPLY
[[ -n "$REPLY" ]] && SYSTEM_USER_AGENT="$REPLY"
echo -e "  ${GREEN}✓${NC} User-Agent: ${SYSTEM_USER_AGENT} (default: Sofon)"
echo ""
sleep 1

# ============================================================
# RESUMO
# ============================================================
show_header
echo -e "${BOLD}RESUMO DA INSTALAÇÃO${NC}"
echo ""
echo -e "  Versão     : ${GREEN}${ASTERISK_VERSION}${NC} (PJSIP + IAX2)"
echo -e "  IP Público : ${CYAN}${PUBLIC_ADDRESS}${NC}"
echo -e "  Rede Local : ${CYAN}${LOCAL_NET}${NC}"
echo -e "  User-Agent : ${CYAN}${SYSTEM_USER_AGENT}${NC}"
echo -e "  Portas     : PJSIP ${CYAN}${PJSIP_PORT}${NC} | IAX2 ${CYAN}${IAX_PORT}${NC} | RTP ${CYAN}10000-20000${NC}"
echo ""
echo -ne "Confirma instalação? [s/N]: "
read -r REPLY
[[ $REPLY =~ ^[SsYy]$ ]] || { echo -e "${RED}✗${NC} Cancelado."; exit 0; }

# ============================================================
# STEP 1 - ATUALIZAR SISTEMA
# ============================================================
show_header
show_progress 1 14 "Atualizando sistema"
run apt-get update
DEBIAN_FRONTEND=noninteractive run apt-get upgrade -y
log "Sistema atualizado"
sleep 1

# ============================================================
# STEP 2 - DEPENDÊNCIAS
# ============================================================
show_header
show_progress 2 14 "Instalando dependências"
DEPS=(
    build-essential git wget curl autoconf automake libtool
    libxml2-dev libncurses5-dev uuid-dev libjansson-dev
    libssl-dev libsqlite3-dev libedit-dev pkg-config
    libspeex-dev libspeexdsp-dev libopus-dev
    unixodbc-dev libnewt-dev libpq-dev
    libiksemel-dev libgmime-3.0-dev libradcli-dev
    libcurl4-openssl-dev libpopt-dev sox mpg123 libsox-fmt-all
)

DEBIAN_FRONTEND=noninteractive apt-get install -y "${DEPS[@]}" >> "$LOG_FILE" 2>&1 || err "Falha nas dependências"
log "Dependências instaladas"
sleep 1

# ============================================================
# STEP 3 - DOWNLOAD
# ============================================================
show_header
show_progress 3 14 "Baixando Asterisk ${ASTERISK_VERSION}"
cd /usr/src
[[ -d "asterisk-${ASTERISK_VERSION}" ]] && rm -rf "asterisk-${ASTERISK_VERSION}"
[[ -f "asterisk-${ASTERISK_VERSION}.tar.gz" ]] && rm -f "asterisk-${ASTERISK_VERSION}.tar.gz"

wget -q --show-progress \
    "https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz" \
    -O "asterisk-${ASTERISK_VERSION}.tar.gz" || err "Falha no download"

tar -xzf "asterisk-${ASTERISK_VERSION}.tar.gz" >> "$LOG_FILE" 2>&1 || err "Falha ao extrair"
cd "asterisk-${ASTERISK_VERSION}" || err "Diretório não encontrado"
log "Download e extração concluídos"
sleep 1

# ============================================================
# STEP 4 - PRÉ-REQUISITOS
# ============================================================
show_header
show_progress 4 14 "Instalando pré-requisitos do Asterisk"
contrib/scripts/install_prereq install >> "$LOG_FILE" 2>&1 || warn "Alguns pré-requisitos falharam (pode ser normal)"
log "Pré-requisitos concluídos"
sleep 1

# ============================================================
# STEP 5 - CONFIGURE
# FIX: sem chan_sip, não precisa de --with-pjproject-bundled nem python
# (res_pjsip já vem embutido no core do Asterisk 22)
# ============================================================
show_header
show_progress 5 14 "Configurando compilação"

./configure --with-jansson-bundled >> "$LOG_FILE" 2>&1 || err "Falha no ./configure"

make menuselect.makeopts >> "$LOG_FILE" 2>&1

menuselect/menuselect \
    --enable format_mp3 \
    --enable codec_speex \
    --enable codec_gsm \
    --enable codec_g722 \
    --enable codec_ilbc \
    --enable res_srtp \
    --enable res_pjsip \
    --enable res_pjsip_session \
    --enable chan_pjsip \
    --enable chan_iax2 \
    --disable chan_sip \
    menuselect.makeopts >> "$LOG_FILE" 2>&1 || true
# codec_opus NÃO entra no menuselect: é um módulo binário externo (Digium) que só é
# baixado pela UI ncurses interativa do menuselect - o --enable via CLI não dispara o
# fetch e fica sempre desabilitado silenciosamente. Baixado manualmente no STEP 9 abaixo.
# G.729 (codec_g729a) da Digium é pago - substituído por codec_g72x/Bcg729 (livre,
# patente do G.729 expirou em 2017), compilado no STEP 9 abaixo também.

log "Configuração concluída"
sleep 1

# ============================================================
# STEP 6 - COMPILAR
# ============================================================
show_header
show_progress 6 14 "Compilando Asterisk (5-15 min)..."
make -j"$(nproc)" >> "$LOG_FILE" 2>&1 || err "Falha na compilação - verifique $LOG_FILE"
log "Compilação concluída"
sleep 1

# ============================================================
# STEP 7 - INSTALAR
# FIX: backup ANTES do make install; samples apenas em fresh install
# ============================================================
show_header
show_progress 7 14 "Instalando binários"

# Backup com timestamp completo para proteger re-execuções
for f in pjsip.conf iax.conf extensions.conf rtp.conf modules.conf manager.conf http.conf; do
    [[ -f /etc/asterisk/$f ]] && \
        cp /etc/asterisk/$f "/etc/asterisk/${f}.bak-$(date +%Y%m%d%H%M%S)"
done

make install >> "$LOG_FILE" 2>&1 || err "Falha no make install"
make config  >> "$LOG_FILE" 2>&1 || true  # instala apenas init/systemd script
make install-logrotate >> "$LOG_FILE" 2>&1 || true

# Samples apenas em fresh install (sem asterisk.conf pré-existente)
if [[ ! -f /etc/asterisk/asterisk.conf ]]; then
    make samples >> "$LOG_FILE" 2>&1 || true
    log "Samples gerados (fresh install)"
else
    log "Configs existentes preservadas - samples ignorados"
fi

ldconfig

[[ -x /usr/sbin/asterisk ]] || {
    warn "Binário não copiado automaticamente, copiando manualmente..."
    cp /usr/src/asterisk-${ASTERISK_VERSION}/main/asterisk /usr/sbin/asterisk
    chmod 755 /usr/sbin/asterisk
}
log "Binários instalados: $(asterisk -V)"
sleep 1

# ============================================================
# STEP 8 - USUÁRIO E PERMISSÕES
# ============================================================
show_header
show_progress 8 14 "Configurando usuário asterisk"

# Timezone do sistema - sem isso o CDR e os logs gravam em UTC, difícil de ler no dia a dia
timedatectl set-timezone America/Sao_Paulo >> "$LOG_FILE" 2>&1 || warn "Falha ao ajustar timezone"
log "Timezone configurado: America/Sao_Paulo"

id -u asterisk &>/dev/null || useradd -r -d /var/lib/asterisk -s /usr/sbin/nologin asterisk

for dir in /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /usr/lib/asterisk; do
    [[ -d "$dir" ]] && chown -R asterisk:asterisk "$dir"
done

sed -i 's/;runuser = asterisk/runuser = asterisk/'   /etc/asterisk/asterisk.conf
sed -i 's/;rungroup = asterisk/rungroup = asterisk/' /etc/asterisk/asterisk.conf
sed -i 's/;verbose = 3/verbose = 3/'                 /etc/asterisk/asterisk.conf
sed -i 's/;debug = 3/debug = 3/'                     /etc/asterisk/asterisk.conf

SERVICE_FILE=""
for f in /lib/systemd/system/asterisk.service /etc/systemd/system/asterisk.service; do
    [[ -f "$f" ]] && SERVICE_FILE="$f" && break
done

if [[ -n "$SERVICE_FILE" ]]; then
    sed -i 's/^User=.*/User=asterisk/'   "$SERVICE_FILE"
    sed -i 's/^Group=.*/Group=asterisk/' "$SERVICE_FILE"
    systemctl daemon-reload
fi

log "Usuário configurado"
sleep 1

# ============================================================
# STEP 9 - CODECS EXTERNOS (Opus + G.729/Bcg729)
# Roda ANTES do primeiro start do Asterisk (STEP 11) - carregar um módulo de
# codec novo a quente num Asterisk já rodando pode falhar com "Cannot update
# type 'opus' in module... because it has already been registered" (sorcery),
# só resolvido com restart completo do processo. Em start limpo isso não ocorre.
# ============================================================
show_header
show_progress 9 14 "Instalando codecs externos (Opus + G.729)"

(cd "/usr/src/asterisk-${ASTERISK_VERSION}" && make install-headers) >> "$LOG_FILE" 2>&1 \
    || warn "make install-headers falhou - G.729 (Bcg729) não será compilado"

ARCH_RAW="$(uname -m)"
DIGIUM_ARCH=""
[[ "$ARCH_RAW" == "x86_64" ]] && DIGIUM_ARCH="x86-64"
AST_MAJOR="${ASTERISK_VERSION%%.*}.0"

if [[ -n "$DIGIUM_ARCH" ]]; then
    OPUS_TARBALL="codec_opus-${AST_MAJOR}-current-${DIGIUM_ARCH}.tar.gz"
    OPUS_URL="https://downloads.digium.com/pub/telephony/codec_opus/asterisk-${AST_MAJOR}/${DIGIUM_ARCH}/${OPUS_TARBALL}"
    OPUS_TMPDIR="$(mktemp -d)"
    if curl -fsSL --max-time 30 "$OPUS_URL" -o "$OPUS_TMPDIR/$OPUS_TARBALL" 2>>"$LOG_FILE"; then
        tar -xzf "$OPUS_TMPDIR/$OPUS_TARBALL" -C "$OPUS_TMPDIR"
        OPUS_PKGDIR="$(find "$OPUS_TMPDIR" -mindepth 1 -maxdepth 1 -type d)"
        cp "$OPUS_PKGDIR"/*.so /usr/lib/asterisk/modules/ 2>>"$LOG_FILE" || true
        mkdir -p /var/lib/asterisk/documentation/thirdparty
        cp "$OPUS_PKGDIR"/*config*.xml /var/lib/asterisk/documentation/thirdparty/ 2>>"$LOG_FILE" || true
        chown root:root /usr/lib/asterisk/modules/codec_opus.so /usr/lib/asterisk/modules/format_ogg_opus.so 2>/dev/null || true
        chmod 755 /usr/lib/asterisk/modules/codec_opus.so /usr/lib/asterisk/modules/format_ogg_opus.so 2>/dev/null || true
        log "codec_opus instalado (download Digium)"
    else
        warn "Download do codec_opus falhou (${OPUS_URL}) - seguindo sem ele"
    fi
    rm -rf "$OPUS_TMPDIR"
else
    warn "Arquitetura ${ARCH_RAW} sem binário Opus disponível na Digium - pulando"
fi

apt-get install -y libbcg729-dev >> "$LOG_FILE" 2>&1 || warn "libbcg729-dev indisponível nos repositórios - seguindo sem G.729"

if ldconfig -p | grep -q libbcg729; then
    cd /usr/src
    rm -rf asterisk-g72x
    if git clone --depth 1 https://github.com/arkadijs/asterisk-g72x.git >> "$LOG_FILE" 2>&1; then
        (
            cd asterisk-g72x
            ./autogen.sh
            ./configure --with-bcg729
            make
            make install
        ) >> "$LOG_FILE" 2>&1 \
            && chown root:root /usr/lib/asterisk/modules/codec_g729.so 2>/dev/null \
            && log "codec_g729 instalado (Bcg729, livre - patente expirada em 2017)" \
            || warn "Falha ao compilar codec_g729 (Bcg729) - seguindo sem G.729"
    else
        warn "Clone de asterisk-g72x falhou - seguindo sem G.729"
    fi
else
    warn "libbcg729 não instalada - seguindo sem G.729"
fi

ldconfig
log "Codecs externos processados"
sleep 1

# ============================================================
# STEP 10 - CONFIGS DO ASTERISK
# FIX: dialplan usa switch => Realtime/ para ramais com nomes arbitrários
# ============================================================
show_header
show_progress 10 14 "Criando configurações"

# rtp.conf
# rtcpevents=yes: emite RTCPSent/RTCPReceived no AMI (jitter/packet loss/RTT por canal em
# chamada) - default do Asterisk é 'no', sem isso o backend não tem como popular qualidade de
# rede em tempo real (ver src/asterisk/transport/ami-events.ts)
cat > /etc/asterisk/rtp.conf << 'EOF'
[general]
rtpstart=10000
rtpend=20000
strictrtp=yes
probation=4
rtcpevents=yes
EOF

# http.conf - servidor HTTP embutido do Asterisk, usado só pelo WebSocket do WebRTC (res_http_websocket
# expõe /ws sozinho quando enabled=yes; sem TLS por enquanto, ver WS_PORT no topo do script)
cat > /etc/asterisk/http.conf << EOF
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=$WS_PORT
EOF

# pjsip.conf
cat > /etc/asterisk/pjsip.conf << EOF
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:$PJSIP_PORT
external_media_address=$PUBLIC_ADDRESS
external_signaling_address=$PUBLIC_ADDRESS
local_net=$LOCAL_NET

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:$PJSIP_PORT
external_media_address=$PUBLIC_ADDRESS
external_signaling_address=$PUBLIC_ADDRESS
local_net=$LOCAL_NET

; WebRTC (softphone no browser) - sinalização SIP sobre WebSocket, servida pelo HTTP embutido do
; Asterisk (ver http.conf, path fixo /ws). Sem TLS por enquanto (ver WS_PORT no topo do script).
[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0

[global]
type=global
max_initial_qualify_time=4
default_from_user=asterisk
keep_alive_interval=90
user_agent=$SYSTEM_USER_AGENT

[endpoint-basic](!)
type=endpoint
context=ramais
disallow=all
allow=opus
allow=ulaw
allow=alaw
direct_media=no
dtmf_mode=rfc4733
EOF

# iax.conf - só troncos (ver backend Trunk.type="iax"), sem ramal IAX2 (dispositivo raro no
# mercado, ramais continuam 100% PJSIP). requirecalltoken=yes mitiga o DoS de amplificação/spoofing
# conhecido do protocolo IAX2 (call token) - obrigatório dado o objetivo de segurança da migração.
cat > /etc/asterisk/iax.conf << EOF
[general]
bindport=$IAX_PORT
bindaddr=0.0.0.0
disallow=all
allow=opus
allow=ulaw
allow=alaw
requirecalltoken=yes
EOF

# extensions.conf
# FIX: contexto [ramais] usa switch => Realtime/ para suportar
# ramais com nomes arbitrários (ex: 2002_16824d1144) via tabela no PostgreSQL.
# O padrão _1XXX foi removido - o Asterisk consulta a tabela extensions
# (mapeada no extconfig.conf) para resolver cada exten dinamicamente.
# Esqueleto global do dialplan em arquivo separado (não em extensions.conf direto) - permite ao
# backend se auto-curar via ensureBaseDialplan() (src/asterisk/base-dialplan.repository.ts) se esse
# arquivo for perdido numa reinstalação parcial, sem precisar reaplicar este script inteiro na mão.
# Precisa ficar em sincronia manual com o conteúdo espelhado em base-dialplan.repository.ts.
cat > /etc/asterisk/sofon-managed.conf << 'EOF'
[ramais]
; Delega lookup de ramais para Realtime (tabela extensions no PostgreSQL)
; Suporta qualquer formato de exten: 1001, 2002_16824d1144, etc.
switch => Realtime/ramais@extensions

; Fallbacks locais - não conflitam pois são extens exatos, não padrões
exten => *97,1,VoiceMailMain(${CALLERID(num)}@default)
exten => *43,1,Answer()
 same => n,Echo()
exten => *60,1,Answer()
 same => n,MusicOnHold()

; TRANSFER_CONTEXT das chamadas inbound (ver inboundroute.repository.ts) - resolvido em tempo real
; via AGI pro ramal OU fila da MESMA empresa (CHANNEL(accountcode)), sem precisar saber de antemão
; se o dígito discado na transferência é um ramal ou um número de fila. O AGI já faz "EXEC Goto"
; pro destino certo quando encontra (ver handleTransferRoute em agi-server.ts) - o Congestion()
; abaixo só roda quando ele NÃO encontra nada (AGI retorna sem ter dado Goto).
[transfer]
exten => _X.,1,NoOp(Transferencia solicitada: ${EXTEN})
 same => n,Set(TRANSFERRED=1)
 same => n,Set(CDR(direction)=transfer)
 same => n,AGI(agi://127.0.0.1:4573/transfer-route)
 same => n,Congestion(3)

[default]
exten => s,1,Hangup()

[from-trunk]
; Todas as trunks inbound compartilham esse contexto (ps_endpoints.context=from-trunk).
; TRUNKID vem do setvar do endpoint - isola o dialplan por trunk mesmo com DID duplicado entre empresas.
exten => _X.,1,Goto(from-trunk-routed,${EXTEN}_${TRUNKID},1)

[from-trunk-routed]
; Delega lookup de rotas de entrada para Realtime (tabela extensions no PostgreSQL)
; exten gravado como <didNumber>_<trunkId> por InboundRouteRepository
switch => Realtime/from-trunk-routed@extensions

; DID sem rota cadastrada - cause 1 (Unallocated number) -> PJSIP responde 404 Not Found
; HANGUPCAUSE é função read-only (${HANGUPCAUSE}); a cause real só é setada via argumento do Hangup()
; FIX: NÃO declarar um catch-all _X. estático aqui - padrão estático tem prioridade
; sobre "switch => Realtime/..." no mesmo contexto, então _X. bloquearia TODA rota
; realtime válida (qualquer exten <didNumber>_<trunkId> começa com dígito). O "i"
; já cobre o caso de nenhuma rota (estática ou realtime) ser encontrada.
exten => i,1,Noop(DID sem rota: ${EXTEN})
 same => n,Hangup(1)

; queues-app, timeconditions, announcements, ivrs, holidays, request-templates, ixc-nodes, formatters,
; variables, variable-conditions, callcenter-surveys e flows/flow-nodes são contextos compartilhados de BAIXA
; escrita (só mudam por CRUD via API, nunca por ligação) - em vez de Realtime (query no Postgres a
; cada Goto, pbx_realtime não tem cache), o dialplan é materializado em arquivo estático por empresa
; em /etc/asterisk/dialplan-extra/<contexto>/<asteriskId>.conf, regenerado + reload (`dialplan reload`)
; a cada CRUD (ver src/asterisk/dialplan-file.repository.ts). `ramais`/`from-trunk-routed` continuam
; via Realtime (alta escrita, fora desse escopo).
; #tryinclude (não #include) - não erra quando a empresa ainda não gerou nenhum .conf pra esse
; contexto (glob sem match); #include exige que exista pelo menos 1 arquivo. Caminho relativo é
; resolvido a partir de /etc/asterisk (astetcdir), não deste arquivo - funciona igual incluído
; a partir de extensions.conf ou direto.
[queues-app]
#tryinclude "dialplan-extra/queues-app/*.conf"

[timeconditions]
#tryinclude "dialplan-extra/timeconditions/*.conf"

[announcements]
#tryinclude "dialplan-extra/announcements/*.conf"

[ivrs]
#tryinclude "dialplan-extra/ivrs/*.conf"

[holidays]
#tryinclude "dialplan-extra/holidays/*.conf"

[request-templates]
#tryinclude "dialplan-extra/request-templates/*.conf"

[ixc-nodes]
#tryinclude "dialplan-extra/ixc-nodes/*.conf"

[formatters]
#tryinclude "dialplan-extra/formatters/*.conf"

[variables]
#tryinclude "dialplan-extra/variables/*.conf"

[variable-conditions]
#tryinclude "dialplan-extra/variable-conditions/*.conf"

[callcenter-surveys]
#tryinclude "dialplan-extra/callcenter-surveys/*.conf"

[flows]
#tryinclude "dialplan-extra/flows/*.conf"

[flow-nodes]
#tryinclude "dialplan-extra/flow-nodes/*.conf"
EOF

cat > /etc/asterisk/extensions.conf << 'EOF'
[general]
static=yes
writeprotect=no

[globals]
LANGUAGE=pt_BR

; Esqueleto global (ramais/transfer/from-trunk/from-trunk-routed + tryinclude dos contextos
; estáticos por empresa) mora em arquivo próprio - ver sofon-managed.conf acima. Mantém este
; arquivo estável e livre pra edição manual do cliente sem risco de sobrescrita pelo backend.
#include sofon-managed.conf
EOF

# sofon-managed-moh.conf - materializa só o #tryinclude de classes MOH por fila (Audio cadastrado
# como música de espera, ver src/asterisk/destinations/musiconhold.repository.ts). Não define
# nenhuma classe própria - [default] do pacote asterisk-moh-* continua intocado. Backend se
# auto-cura via ensureBaseMusiconhold() (base-musiconhold.repository.ts) se este arquivo for
# perdido numa reinstalação parcial.
cat > /etc/asterisk/sofon-managed-moh.conf << 'EOF'
#tryinclude "musiconhold-extra/*.conf"
EOF

# Acrescenta o #tryinclude ao musiconhold.conf já existente (shipped com [default] pelo pacote
# asterisk-moh-*) sem sobrescrever nada - mesma estratégia usada em extensions.conf acima.
if ! grep -qi '^[[:space:]]*#tryinclude[[:space:]]*"\?sofon-managed-moh\.conf"\?[[:space:]]*$' /etc/asterisk/musiconhold.conf 2>/dev/null; then
    printf '\n; Sofon PABX, classes MOH gerenciadas\n#tryinclude "sofon-managed-moh.conf"\n' >> /etc/asterisk/musiconhold.conf
fi

# features.conf - transferência DTMF atendida durante a chamada. Códigos: *2 atendida, *1 grava,
# parkcall #72. Quem pode
# de fato disparar (opção t/T no Dial()/Queue()) é controlado no dialplan. Chamadas inbound usam
# "t" para só o ramal transferir, chamadas outbound usam "T" para o ramal chamador transferir.
cat > /etc/asterisk/features.conf << 'EOF'
[general]
; tempo entre dígitos ao discar o destino da transferência DTMF (depois do #1/*2) - 3s
; original estourava com discagem manual normal (ramal de 4-6 dígitos), tratando cada
; dígito isolado como tentativa própria (ex: discar "1002" virava "1@transfer" +
; "0@transfer" etc, cada um "does not exist")
transferdigittimeout = 8
atxfernoanswertimeout = 15
atxferdropcall = no
atxferloopdelay = 10
xfersound = beep
xferfailsound = beeperr
atxferabort = *1
atxfercomplete = *2
atxferthreeway = *3
atxferswap = *4

[featuremap]
disconnect => *
automixmon => *5
atxfer => *2
parkcall => #72

[applicationmap]
EOF

# cdr.conf - o sample padrão do Asterisk (make samples) vem com unanswered/congestion=yes,
# o que faz o motor de CDR logar uma linha A MAIS por chamada sempre que um Dial() termina em
# BUSY/CONGESTION/NOANSWER (a tentativa em si vira 1 registro, e a continuação do dialplan depois
# do Dial() - Set/NoOp/Hangup - vira um 2º registro "fantasma" com o mesmo linkedid/uniqueid,
# sem dstchannel). Aqui só existe UM Dial() por extensão (sem retry pra outro destino), então não
# há cenário legítimo pra esses 2 registros - unanswered/congestion=no elimina a duplicata.
cat > /etc/asterisk/cdr.conf << 'EOF'
[general]
enable=yes
unanswered=no
congestion=no
endbeforehexten=no
EOF

# modules.conf - garante chan_sip nunca carregado, chan_iax2 sempre carregado
sed -i '/noload.*res_pjsip/d' /etc/asterisk/modules.conf 2>/dev/null || true
grep -q "noload => chan_sip.so" /etc/asterisk/modules.conf 2>/dev/null || \
    printf '\nnoload => chan_sip.so\nload => res_pjsip.so\nload => res_pjsip_session.so\nload => chan_pjsip.so\nload => chan_iax2.so\nload => res_http_websocket.so\nload => res_pjsip_websocket.so\n' >> /etc/asterisk/modules.conf

chown asterisk:asterisk /etc/asterisk/*.conf
log "Configurações criadas"
sleep 1

# ============================================================
# STEP 11 - INICIAR SERVIÇO
# ============================================================
show_header
show_progress 11 14 "Iniciando Asterisk"
systemctl daemon-reload
systemctl enable asterisk >> "$LOG_FILE" 2>&1 || true
systemctl restart asterisk >> "$LOG_FILE" 2>&1 || err "Falha ao iniciar Asterisk"
sleep 4

systemctl is-active --quiet asterisk || err "Asterisk não iniciou - verifique: journalctl -u asterisk -n 50"

asterisk -rx "core reload"     >> "$LOG_FILE" 2>&1 || true
asterisk -rx "dialplan reload" >> "$LOG_FILE" 2>&1 || true

log "Asterisk iniciado"
sleep 1

# ============================================================
# STEP 12 - FIREWALL (nftables + Fail2Ban + manage-fw)
# Clona o manage-fw (https://github.com/rafaelRizzo/manage-fw) e delega pro
# firewall.sh dele - em vez de duplicar aqui a lógica de nftables/Fail2Ban/
# manage-fw, reusa o script genérico (backup+diff automático do nftables.conf,
# --update, --reload, restore do Docker). --update mescla com o config salvo
# numa reinstalação (mantém portas já liberadas + adiciona as novas do
# installer) em vez de sobrescrever - só é passado se já existir config
# anterior, senão o próprio firewall.sh recusa --update (sem baseline salva).
# ============================================================
show_header
show_progress 12 14 "Configurando firewall"

MANAGE_FW_DIR="/opt/manage-fw"
if [[ -d "$MANAGE_FW_DIR/.git" ]]; then
    git -C "$MANAGE_FW_DIR" pull --ff-only >> "$LOG_FILE" 2>&1 || warn "Falha ao atualizar manage-fw, usando cópia local existente"
else
    rm -rf "$MANAGE_FW_DIR"
    git clone --depth 1 https://github.com/rafaelRizzo/manage-fw.git "$MANAGE_FW_DIR" >> "$LOG_FILE" 2>&1 \
        || err "Falha ao clonar manage-fw"
fi

FIREWALL_MODE_FLAG=()
[[ -f /etc/manage-fw/config.args ]] && FIREWALL_MODE_FLAG=(--update)

# --local-tcp 5038 cobre o modelo padrão (bindaddr 127.0.0.1). --private-tcp 5038 é pro caso do
# backend rodar em rede bridge (Dokploy/Swarm, ver backend/CLAUDE.md "Produção atual"), onde
# bindaddr precisa virar 0.0.0.0 manualmente - sem essa liberação o AMI nunca é alcançável a
# partir do container mesmo com o ACL do manager.conf certo (SYN cai no policy drop do host).
bash "$MANAGE_FW_DIR/firewall.sh" \
    "${FIREWALL_MODE_FLAG[@]}" \
    --log "$LOG_FILE" \
    --extra-ssh 21122 \
    --tcp-public 81 \
    --tcp-public "$WS_PORT" \
    --tcp "$PJSIP_PORT" \
    --udp "$PJSIP_PORT,$IAX_PORT" \
    --udp-range 10000-20000 \
    --local-tcp 5038 \
    --private-tcp 3333 \
    --private-tcp 3334 \
    --private-tcp 3335 \
    --private-tcp 5038 \
    --fail2ban \
    --jail-name asterisk \
    --jail-ports "$PJSIP_PORT,$IAX_PORT" \
    --jail-logpath /var/log/asterisk/messages \
    --jail-filter "$SCRIPT_DIR/asterisk-fail2ban.filter" \
    || err "Falha ao configurar firewall (nftables/Fail2Ban/manage-fw)"

log "Firewall configurado (SSH 22+21122, PJSIP/IAX2/RTP whitelist-only, WS $WS_PORT público p/ WebRTC, AMI localhost + rede privada (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), Fail2Ban ativo, manage-fw instalado)"

# ============================================================
# STEP 13 - SEGURANÇA
# ============================================================
show_header
show_progress 13 14 "Aplicando hardening de segurança"

# --- Monitor: diretório de gravações de chamadas ---
mkdir -p /var/spool/asterisk/monitor
chown -R asterisk:asterisk /var/spool/asterisk/monitor
chmod 755 /var/spool/asterisk/monitor
log "Diretório de gravações criado → /var/spool/asterisk/monitor"

# --- Announcements: diretório de áudios custom (subpastas por asteriskId criadas pela API) ---
mkdir -p /var/lib/asterisk/sounds
chown -R asterisk:asterisk /var/lib/asterisk/sounds
chmod 755 /var/lib/asterisk/sounds
log "Diretório de anúncios criado → /var/lib/asterisk/sounds"

# --- Dialplan estático por empresa (queues-app/timeconditions/announcements/ivrs/holidays/
# request-templates/variables/variable-conditions/callcenter-surveys) - arquivos gerados pela API, incluídos via #include em extensions.conf
# (ver src/asterisk/dialplan-file.repository.ts) ---
mkdir -p /etc/asterisk/dialplan-extra/{queues-app,timeconditions,announcements,ivrs,holidays,request-templates,variables,variable-conditions,callcenter-surveys,flows,flow-nodes}
chown -R asterisk:asterisk /etc/asterisk/dialplan-extra
chmod 755 /etc/asterisk/dialplan-extra
log "Diretório de dialplan estático criado → /etc/asterisk/dialplan-extra"

# --- Logger: garante gravação em disco ---
mkdir -p /var/log/asterisk
touch /var/log/asterisk/messages /var/log/asterisk/full
chown -R asterisk:asterisk /var/log/asterisk
chmod 664 /var/log/asterisk/messages /var/log/asterisk/full

cat > /etc/asterisk/logger.conf << 'EOF'
[general]
dateformat=%F %T

[logfiles]
/var/log/asterisk/messages => notice,warning,error
/var/log/asterisk/full     => notice,warning,error,verbose,debug
console                    => notice,warning,error
EOF

chown asterisk:asterisk /etc/asterisk/logger.conf
chmod 640 /etc/asterisk/logger.conf
asterisk -rx "logger reload" >> "$LOG_FILE" 2>&1 || true
sleep 2
log "Logger configurado → /var/log/asterisk/messages"

# Fail2Ban, filtro, jail e manage-fw já configurados pelo firewall.sh no STEP 12.

AMI_SECRET="$(openssl rand -base64 24)"
cat > /etc/asterisk/manager.conf << EOF
[general]
enabled            = yes
port               = 5038
bindaddr           = 127.0.0.1
# "no" derruba com SessionLimit qualquer 2ª conexão do mesmo usuário - o backend mantém uma
# conexão AMI persistente (ami-events.ts, monitoramento em tempo real) o tempo todo logada como
# "admin", e QUALQUER reload de dialplan (ami-client.ts) abre uma 2ª conexão com o mesmo usuário
# em paralelo. Sem "yes" aqui, esse reload é rejeitado silenciosamente (best-effort, só loga
# warning) e o dialplan nunca é recarregado de verdade. bindaddr/permit já restringem a 127.0.0.1.
allowmultiplelogin = yes
displayconnects    = no

[admin]
secret  = $AMI_SECRET
deny    = 0.0.0.0/0.0.0.0
permit  = 127.0.0.1/255.255.255.255
read    = all
write   = all
EOF


chmod 750 /etc/asterisk
chmod 640 /etc/asterisk/*.conf
chown -R asterisk:asterisk /etc/asterisk

asterisk -rx "manager reload" >> "$LOG_FILE" 2>&1 || true
log "Hardening aplicado"

# manage-fw já instalado em /usr/local/sbin/manage-fw pelo firewall.sh no STEP 12.

# ============================================================
# STEP 14 - SINCRONIZAR .ENV DO BACKEND
# Sem chan_sip: SIP_LEGACY_ENABLED sempre false, sem SIP_PORT
# (ver ASTERISK_VERSION/PJSIP_PORT em src/config/env.ts) - o backend
# expõe isso pro frontend via GET /system/sip-config.
# ============================================================
show_header
show_progress 14 14 "Sincronizando configuração com o backend"

set_env_var() {
    local file=$1 key=$2 value=$3
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# SCRIPT_DIR é backend/setups - o .env do backend está sempre um nível acima,
# independente do diretório de onde o installer foi chamado.
BACKEND_ENV_FILE="$SCRIPT_DIR/../.env"

if [[ -f "$BACKEND_ENV_FILE" ]]; then
    set_env_var "$BACKEND_ENV_FILE" "ASTERISK_VERSION" "$ASTERISK_VERSION"
    set_env_var "$BACKEND_ENV_FILE" "SIP_LEGACY_ENABLED" "false"
    set_env_var "$BACKEND_ENV_FILE" "PJSIP_PORT" "$PJSIP_PORT"
    set_env_var "$BACKEND_ENV_FILE" "PUBLIC_ADDRESS" "$PUBLIC_ADDRESS"
    set_env_var "$BACKEND_ENV_FILE" "WS_SCHEME" "ws"
    set_env_var "$BACKEND_ENV_FILE" "WS_PORT" "$WS_PORT"
    log "Backend .env atualizado (${BACKEND_ENV_FILE}) - reinicie o serviço do backend para aplicar"
else
    warn "Backend .env não encontrado em ${BACKEND_ENV_FILE} - adicione manualmente:"
    echo "    ASTERISK_VERSION=${ASTERISK_VERSION}"
    echo "    SIP_LEGACY_ENABLED=false"
    echo "    PJSIP_PORT=${PJSIP_PORT}"
    echo "    PUBLIC_ADDRESS=${PUBLIC_ADDRESS}"
    echo "    WS_SCHEME=ws"
    echo "    WS_PORT=${WS_PORT}"
fi
sleep 1

# ============================================================
# SUMÁRIO FINAL
# ============================================================
show_header
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✓ INSTALAÇÃO CONCLUÍDA!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
asterisk -rx "core show version" 2>/dev/null | head -1 || true
echo ""
echo -e "  Sistema    : ${CYAN}${OS_NAME} ${OS_VERSION}${NC}"
echo -e "  IP Público : ${CYAN}${PUBLIC_ADDRESS}${NC}"
echo -e "  Rede Local : ${CYAN}${LOCAL_NET}${NC}"
echo -e "  PJSIP      : ${CYAN}${PJSIP_PORT}${NC} (UDP/TCP) - chan_sip ausente do build"
echo -e "  WebRTC     : ${CYAN}ws://${PUBLIC_ADDRESS}:${WS_PORT}/ws${NC} - sem TLS (sem domínio ainda); trocar pra wss depois é só mudar WS_SCHEME no .env do backend"
echo -e "  IAX2       : ${CYAN}${IAX_PORT}${NC} (UDP, troncos)"
echo -e "  RTP        : ${CYAN}10000-20000${NC} (UDP)"
echo -e "  Proxy Web  : ${CYAN}80, 443${NC} (HTTP/HTTPS) + ${CYAN}81${NC} (painel Nginx Proxy Manager)"
echo -e "  AMI Secret : ${YELLOW}${AMI_SECRET}${NC}"
echo -e "  Fail2Ban   : ${GREEN}ativo${NC}"
echo -e "  manage-fw  : ${GREEN}/usr/local/sbin/manage-fw${NC}"
echo -e "  Log        : ${CYAN}${LOG_FILE}${NC}"
echo ""
echo -e "  Liberar acesso às portas PJSIP/RTP:"
echo -e "    ${YELLOW}manage-fw add 1.2.3.4${NC}       → libera IP (nftables + Fail2Ban)"
echo -e "    ${YELLOW}manage-fw add 10.0.0.0/24${NC}   → libera bloco CIDR"
echo -e "    ${YELLOW}manage-fw remove 1.2.3.4${NC}    → bloqueia IP"
echo -e "    ${YELLOW}manage-fw list${NC}               → whitelist + banidos"
echo ""
echo -e "  Comandos úteis:"
echo -e "    ${YELLOW}asterisk -rvvv${NC}              → console"
echo -e "    ${YELLOW}systemctl status asterisk${NC}   → status"
echo -e "    ${YELLOW}tail -f /var/log/asterisk/messages${NC}"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
