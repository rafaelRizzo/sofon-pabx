#!/bin/bash
# ============================================================
# INSTALADOR SOFON PBX v6.1 - NATIVO (sem Docker)
# Debian 11+ | Ubuntu 24.04+
# ============================================================

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

ASTERISK_VERSION=""
USE_LEGACY_SIP=false
PUBLIC_ADDRESS=""
LOCAL_NET=""
OS_NAME=""
OS_VERSION=""
LOG_FILE="/var/log/sofon-install.log"
PJSIP_PORT=5060
SIP_PORT=5062
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
    echo -e "  ${BOLD}INSTALADOR SOFON PBX v6.0${NC}"
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
sleep 1

# ============================================================
# ESCOLHA DE VERSÃO
# ============================================================
show_header
echo -e "${BOLD}Escolha a versão do Asterisk:${NC}"
echo ""
echo -e "  ${YELLOW}1)${NC} Asterisk 22.7.0 ${GREEN}(LTS)${NC} - PJSIP Only    (porta 5060)"
echo -e "  ${YELLOW}2)${NC} Asterisk 20.17.0 ${GREEN}(LTS)${NC} - SIP + PJSIP  (SIP:5062 | PJSIP:5063)"
echo ""
echo -ne "${CYAN}→${NC} Opção [1-2]: "
read -r OPCAO
echo ""

case $OPCAO in
    1) ASTERISK_VERSION="22.7.0"; USE_LEGACY_SIP=false; PJSIP_PORT=5060
       echo -e "  ${GREEN}✓${NC} Asterisk $ASTERISK_VERSION selecionado (PJSIP Only)" ;;
    2) ASTERISK_VERSION="20.17.0"; USE_LEGACY_SIP=true; PJSIP_PORT=5063
       echo -e "  ${GREEN}✓${NC} Asterisk $ASTERISK_VERSION selecionado (SIP + PJSIP)" ;;
    *) err "Opção inválida" ;;
esac
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
echo -e "  Versão     : ${GREEN}${ASTERISK_VERSION}${NC}"
echo -e "  IP Público : ${CYAN}${PUBLIC_ADDRESS}${NC}"
echo -e "  Rede Local : ${CYAN}${LOCAL_NET}${NC}"
echo -e "  User-Agent : ${CYAN}${SYSTEM_USER_AGENT}${NC}"
if [[ "$USE_LEGACY_SIP" == true ]]; then
    echo -e "  Portas     : SIP ${CYAN}${SIP_PORT}${NC} | PJSIP ${CYAN}${PJSIP_PORT}${NC} | RTP ${CYAN}10000-20000${NC}"
else
    echo -e "  Portas     : PJSIP ${CYAN}${PJSIP_PORT}${NC} | RTP ${CYAN}10000-20000${NC}"
fi
echo ""
echo -ne "Confirma instalação? [s/N]: "
read -r REPLY
[[ $REPLY =~ ^[SsYy]$ ]] || { echo -e "${RED}✗${NC} Cancelado."; exit 0; }

# ============================================================
# STEP 1 - ATUALIZAR SISTEMA
# ============================================================
show_header
show_progress 1 13 "Atualizando sistema"
run apt-get update
DEBIAN_FRONTEND=noninteractive run apt-get upgrade -y
log "Sistema atualizado"
sleep 1

# ============================================================
# STEP 2 - DEPENDÊNCIAS
# ============================================================
show_header
show_progress 2 13 "Instalando dependências"
DEPS=(
    build-essential git wget curl autoconf automake libtool
    libxml2-dev libncurses5-dev uuid-dev libjansson-dev
    libssl-dev libsqlite3-dev libedit-dev pkg-config
    libspeex-dev libspeexdsp-dev libopus-dev
    unixodbc-dev libnewt-dev libpq-dev
    libiksemel-dev libgmime-3.0-dev libradcli-dev
    libcurl4-openssl-dev libpopt-dev sox mpg123 libsox-fmt-all
)
[[ "$USE_LEGACY_SIP" == true ]] && DEPS+=(python3 python3-dev libsrtp2-dev)

DEBIAN_FRONTEND=noninteractive apt-get install -y "${DEPS[@]}" >> "$LOG_FILE" 2>&1 || err "Falha nas dependências"
log "Dependências instaladas"
sleep 1

# ============================================================
# STEP 3 - DOWNLOAD
# ============================================================
show_header
show_progress 3 13 "Baixando Asterisk ${ASTERISK_VERSION}"
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
show_progress 4 13 "Instalando pré-requisitos do Asterisk"
contrib/scripts/install_prereq install >> "$LOG_FILE" 2>&1 || warn "Alguns pré-requisitos falharam (pode ser normal)"
[[ "$USE_LEGACY_SIP" == true ]] && contrib/scripts/get_mp3_source.sh >> "$LOG_FILE" 2>&1 || true
log "Pré-requisitos concluídos"
sleep 1

# ============================================================
# STEP 5 - CONFIGURE
# ============================================================
show_header
show_progress 5 13 "Configurando compilação"

CONF_OPTS="--with-jansson-bundled"
[[ "$USE_LEGACY_SIP" == true ]] && CONF_OPTS="$CONF_OPTS --with-pjproject-bundled"

./configure $CONF_OPTS >> "$LOG_FILE" 2>&1 || err "Falha no ./configure"

make menuselect.makeopts >> "$LOG_FILE" 2>&1

menuselect/menuselect \
    --enable format_mp3 \
    --enable codec_opus \
    --enable codec_speex \
    --enable codec_gsm \
    --enable codec_g722 \
    --enable codec_ilbc \
    --enable res_srtp \
    menuselect.makeopts >> "$LOG_FILE" 2>&1 || true
# G.729 NÃO entra aqui: codec proprietário (Digium), sem build open-source.
# Precisa comprar o módulo binário e instalar manualmente em /usr/lib/asterisk/modules.

if [[ "$USE_LEGACY_SIP" == true ]]; then
    menuselect/menuselect \
        --enable chan_sip \
        --enable res_pjsip \
        --enable res_pjsip_session \
        --enable chan_pjsip \
        menuselect.makeopts >> "$LOG_FILE" 2>&1 || true
fi

log "Configuração concluída"
sleep 1

# ============================================================
# STEP 6 - COMPILAR
# ============================================================
show_header
show_progress 6 13 "Compilando Asterisk (5-15 min)..."
make -j"$(nproc)" >> "$LOG_FILE" 2>&1 || err "Falha na compilação — verifique $LOG_FILE"
log "Compilação concluída"
sleep 1

# ============================================================
# STEP 7 - INSTALAR
# FIX: backup ANTES do make install; samples apenas em fresh install
# ============================================================
show_header
show_progress 7 13 "Instalando binários"

# Backup com timestamp completo para proteger re-execuções
for f in sip.conf pjsip.conf extensions.conf rtp.conf modules.conf manager.conf; do
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
    log "Configs existentes preservadas — samples ignorados"
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
show_progress 8 13 "Configurando usuário asterisk"

# Timezone do sistema — sem isso o CDR e os logs gravam em UTC, difícil de ler no dia a dia
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
# STEP 9 - CONFIGS DO ASTERISK
# FIX: dialplan usa switch => Realtime/ para ramais com nomes arbitrários
# ============================================================
show_header
show_progress 9 13 "Criando configurações"

# rtp.conf
cat > /etc/asterisk/rtp.conf << 'EOF'
[general]
rtpstart=10000
rtpend=20000
strictrtp=yes
probation=4
EOF

# sip.conf (só se USE_LEGACY_SIP)
if [[ "$USE_LEGACY_SIP" == true ]]; then
    cat > /etc/asterisk/sip.conf << EOF
[general]
bindport=$SIP_PORT
bindaddr=0.0.0.0
useragent=$SYSTEM_USER_AGENT
transport=udp,tcp
tcpenable=yes
context=default
allowguest=no
disallow=all
allow=opus
allow=ulaw
allow=alaw
nat=force_rport,comedia
externip=$PUBLIC_ADDRESS
localnet=$LOCAL_NET
rtpstart=10000
rtpend=20000
language=pt_BR
dtmfmode=rfc2833
directmedia=no
alwaysauthreject=yes
qualify=yes
qualifyfreq=60
rtcachefriends=yes
rtautoclear=60
registertrying=yes

EOF
fi

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

# extensions.conf
# FIX: contexto [ramais] usa switch => Realtime/ para suportar
# ramais com nomes arbitrários (ex: 2002_16824d1144) via tabela no PostgreSQL.
# O padrão _1XXX foi removido — o Asterisk consulta a tabela extensions
# (mapeada no extconfig.conf) para resolver cada exten dinamicamente.
cat > /etc/asterisk/extensions.conf << 'EOF'
[general]
static=yes
writeprotect=no

[globals]
LANGUAGE=pt_BR

[ramais]
; Delega lookup de ramais para Realtime (tabela extensions no PostgreSQL)
; Suporta qualquer formato de exten: 1001, 2002_16824d1144, etc.
switch => Realtime/ramais@extensions

; Fallbacks locais — não conflitam pois são extens exatos, não padrões
exten => *97,1,VoiceMailMain(${CALLERID(num)}@default)
exten => *43,1,Answer()
 same => n,Echo()
exten => *60,1,Answer()
 same => n,MusicOnHold()

[default]
exten => s,1,Hangup()

[from-trunk]
; Todas as trunks inbound compartilham esse contexto (ps_endpoints.context=from-trunk).
; TRUNKID vem do setvar do endpoint — isola o dialplan por trunk mesmo com DID duplicado entre empresas.
exten => _X.,1,Goto(from-trunk-routed,${EXTEN}_${TRUNKID},1)

[from-trunk-routed]
; Delega lookup de rotas de entrada para Realtime (tabela extensions no PostgreSQL)
; exten gravado como <didNumber>_<trunkId> por InboundRouteRepository
switch => Realtime/from-trunk-routed@extensions

; DID sem rota cadastrada — cause 1 (Unallocated number) -> PJSIP responde 404 Not Found
; HANGUPCAUSE é função read-only (${HANGUPCAUSE}); a cause real só é setada via argumento do Hangup()
; FIX: NÃO declarar um catch-all _X. estático aqui — padrão estático tem prioridade
; sobre "switch => Realtime/..." no mesmo contexto, então _X. bloquearia TODA rota
; realtime válida (qualquer exten <didNumber>_<trunkId> começa com dígito). O "i"
; já cobre o caso de nenhuma rota (estática ou realtime) ser encontrada.
exten => i,1,Noop(DID sem rota: ${EXTEN})
 same => n,Hangup(1)

; queues-app, timeconditions, announcements, ivrs, holidays, request-templates, variables,
; variable-conditions e callcenter-surveys são contextos
; compartilhados de BAIXA escrita (só mudam por CRUD via API, nunca por ligação) — em vez de
; Realtime (query no Postgres a cada Goto, pbx_realtime não tem cache), o dialplan é materializado
; em arquivo estático por empresa em /etc/asterisk/dialplan-extra/<contexto>/<asteriskId>.conf,
; regenerado + reload (`dialplan reload`) a cada CRUD (ver src/asterisk/dialplan-file.repository.ts).
; `ramais`/`from-trunk-routed` continuam via Realtime (alta escrita, fora desse escopo).
; #tryinclude (não #include) — não erra quando a empresa ainda não gerou nenhum .conf pra esse
; contexto (glob sem match); #include exige que exista pelo menos 1 arquivo.
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

[variables]
#tryinclude "dialplan-extra/variables/*.conf"

[variable-conditions]
#tryinclude "dialplan-extra/variable-conditions/*.conf"

[callcenter-surveys]
#tryinclude "dialplan-extra/callcenter-surveys/*.conf"
EOF

# modules.conf — garante chan_sip carregado se necessário
if [[ "$USE_LEGACY_SIP" == true ]]; then
    sed -i '/noload.*chan_sip/d'    /etc/asterisk/modules.conf 2>/dev/null || true
    sed -i '/noload.*res_pjsip/d'  /etc/asterisk/modules.conf 2>/dev/null || true
    grep -q "chan_sip.so" /etc/asterisk/modules.conf 2>/dev/null || \
        printf '\nload => chan_sip.so\nload => res_pjsip.so\nload => res_pjsip_session.so\nload => chan_pjsip.so\n' >> /etc/asterisk/modules.conf
fi

chown asterisk:asterisk /etc/asterisk/*.conf
log "Configurações criadas"
sleep 1

# ============================================================
# STEP 10 - INICIAR SERVIÇO
# ============================================================
show_header
show_progress 10 13 "Iniciando Asterisk"
systemctl daemon-reload
systemctl enable asterisk >> "$LOG_FILE" 2>&1 || true
systemctl restart asterisk >> "$LOG_FILE" 2>&1 || err "Falha ao iniciar Asterisk"
sleep 4

systemctl is-active --quiet asterisk || err "Asterisk não iniciou — verifique: journalctl -u asterisk -n 50"

asterisk -rx "core reload"     >> "$LOG_FILE" 2>&1 || true
asterisk -rx "dialplan reload" >> "$LOG_FILE" 2>&1 || true

log "Asterisk iniciado"
sleep 1

# ============================================================
# STEP 11 - FIREWALL (nftables)
# ============================================================
show_header
show_progress 11 13 "Configurando firewall"

# Desativa UFW — conflita com nftables
if command -v ufw &>/dev/null; then
    ufw disable >> "$LOG_FILE" 2>&1 || true
    systemctl disable ufw >> "$LOG_FILE" 2>&1 || true
    log "UFW desativado"
fi

DEBIAN_FRONTEND=noninteractive apt-get install -y nftables conntrack >> "$LOG_FILE" 2>&1 || err "Falha ao instalar nftables"

mkdir -p /etc/fail2ban
[[ -f /etc/fail2ban/ip.whitelist ]] || touch /etc/fail2ban/ip.whitelist

# Lê whitelist existente para popular o set inicial
INITIAL_ELEMENTS=$(grep -v '^[[:space:]]*#\|^[[:space:]]*$' /etc/fail2ban/ip.whitelist 2>/dev/null \
    | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g' || true)

if [[ "$USE_LEGACY_SIP" == true ]]; then
    JAIL_PORTS="$SIP_PORT,5061,$PJSIP_PORT"
else
    JAIL_PORTS="$PJSIP_PORT"
fi

{
    echo '#!/usr/sbin/nft -f'
    echo ''
    echo '# Recria apenas nossa tabela — preserva tabelas do Docker'
    echo 'add table inet filter'
    echo 'flush table inet filter'
    echo ''
    echo 'table inet filter {'
    echo ''
    echo '    set whitelist {'
    echo '        type ipv4_addr'
    echo '        flags interval'
    if [[ -n "$INITIAL_ELEMENTS" ]]; then
        echo "        elements = { ${INITIAL_ELEMENTS} }"
    fi
    echo '    }'
    echo ''
    echo '    chain input {'
    echo '        type filter hook input priority 0; policy drop;'
    echo ''
    echo '        iif "lo" accept'
    echo '        ct state established,related accept'
    echo '        ip protocol icmp accept'
    echo '        ip6 nexthdr ipv6-icmp accept'
    echo ''
    echo '        tcp dport { 22, 21122 } accept'
    echo ''
    echo '        # Nginx Proxy Manager (host) — 80/443 público (HTTP/HTTPS + ACME), 81 painel admin'
    echo '        tcp dport { 80, 443, 81 } accept'
    echo ''
    if [[ "$USE_LEGACY_SIP" == true ]]; then
        echo "        ip saddr @whitelist tcp dport { ${SIP_PORT}, 5061, ${PJSIP_PORT} } accept"
        echo "        ip saddr @whitelist udp dport { ${SIP_PORT}, 5061, ${PJSIP_PORT} } accept"
    else
        echo "        ip saddr @whitelist tcp dport ${PJSIP_PORT} accept"
        echo "        ip saddr @whitelist udp dport ${PJSIP_PORT} accept"
    fi
    echo ''
    echo '        ip saddr @whitelist udp dport 10000-20000 accept'
    echo ''
    echo '        ip saddr 127.0.0.1 tcp dport 5038 accept'
    echo ''
    echo '        # Backend (3333, network_mode host) — só redes privadas/Docker, nunca exposto à internet'
    echo '        ip saddr { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 } tcp dport 3333 accept'
    echo '    }'
    echo ''
    echo '    chain forward {'
    echo '        type filter hook forward priority 0; policy accept;'
    echo '    }'
    echo ''
    echo '    chain output {'
    echo '        type filter hook output priority 0; policy accept;'
    echo '    }'
    echo '}'
} > /etc/nftables.conf

nft -f /etc/nftables.conf >> "$LOG_FILE" 2>&1 || err "Falha ao aplicar regras nftables"
systemctl enable nftables >> "$LOG_FILE" 2>&1 || true
log "Firewall nftables configurado (SSH 22+21122, SIP/RTP whitelist-only, AMI localhost-only)"

# Docker perde as regras de MASQUERADE quando nftables é recarregado
if systemctl is-active --quiet docker 2>/dev/null; then
    warn "Docker detectado — reiniciando para restaurar regras de NAT (MASQUERADE)..."
    systemctl restart docker >> "$LOG_FILE" 2>&1 || warn "Falha ao reiniciar Docker"
    log "Docker reiniciado — regras de MASQUERADE restauradas"
fi

# ============================================================
# STEP 12 - SEGURANÇA
# ============================================================
show_header
show_progress 12 13 "Aplicando hardening de segurança"

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
# request-templates/variables/variable-conditions/callcenter-surveys) — arquivos gerados pela API, incluídos via #include em extensions.conf
# (ver src/asterisk/dialplan-file.repository.ts) ---
mkdir -p /etc/asterisk/dialplan-extra/{queues-app,timeconditions,announcements,ivrs,holidays,request-templates,variables,variable-conditions,callcenter-surveys}
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

# --- Fail2Ban ---
DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban >> "$LOG_FILE" 2>&1 || warn "Fail2Ban não instalado"
mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d /etc/fail2ban/action.d

cat > /etc/fail2ban/filter.d/asterisk.conf << 'EOF'
[Definition]
failregex = NOTICE\[\d+\].*failed for '?<HOST>:\d+'?.*(No matching endpoint|Failed to authenticate|Wrong password)
            NOTICE\[\d+\].*Registration from.*failed for '?<HOST>:\d+'?

ignoreregex =
EOF

# FIX: a action nftables-allports de fábrica só bloqueia TCP (meta l4proto tcp),
# ignorando UDP mesmo com protocol=udp,tcp no jail — SIP é majoritariamente UDP.
# Action própria: bloqueia por IP sem restrição de protocolo.
cat > /etc/fail2ban/action.d/nftables-asterisk.conf << 'EOF'
[Definition]
actionstart = nft add table inet f2b-<name>
              nft add set inet f2b-<name> addr-set-<name> { type ipv4_addr\; }
              nft add chain inet f2b-<name> f2b-chain { type filter hook input priority filter - 1\; }
              nft add rule inet f2b-<name> f2b-chain ip saddr @addr-set-<name> drop

actionstop = nft delete table inet f2b-<name>

actioncheck = nft list table inet f2b-<name> >/dev/null 2>&1

actionban = nft add element inet f2b-<name> addr-set-<name> { <ip> }

actionunban = nft delete element inet f2b-<name> addr-set-<name> { <ip> }

[Init]
name = default
EOF

WHITELIST_F2B=$(grep -v '^#\|^$' /etc/fail2ban/ip.whitelist 2>/dev/null | tr '\n' ' ' || true)

cat > /etc/fail2ban/jail.d/asterisk.conf << EOF
[asterisk]
enabled   = true
port      = ${JAIL_PORTS}
protocol  = udp,tcp
filter    = asterisk
logpath   = /var/log/asterisk/messages
maxretry  = 3
findtime  = 300
bantime   = 86400
ignoreip  = 127.0.0.1/8 ::1 ${WHITELIST_F2B}
action    = nftables-asterisk[name=asterisk]
EOF

systemctl enable fail2ban >> "$LOG_FILE" 2>&1 || true
systemctl restart fail2ban >> "$LOG_FILE" 2>&1 || warn "Fail2Ban não reiniciou"

sleep 2
while IFS= read -r ip; do
    [[ "$ip" =~ ^#|^$ ]] && continue
    fail2ban-client set asterisk unbanip "$ip" >> "$LOG_FILE" 2>&1 || true
done < /etc/fail2ban/ip.whitelist
log "Fail2Ban configurado"

AMI_SECRET="$(openssl rand -base64 24)"
cat > /etc/asterisk/manager.conf << EOF
[general]
enabled            = yes
port               = 5038
bindaddr           = 127.0.0.1
allowmultiplelogin = no
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

# --- manage-fw (helper global — whitelist nftables + Fail2Ban) ---
cat > /usr/local/sbin/manage-fw << 'MANAGE_FW_EOF'
#!/bin/bash
# manage-fw — gerencia whitelist de IPs no nftables + Fail2Ban (Asterisk)
# Uso: manage-fw {add|remove|list} [IP[/CIDR]]

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

WHITELIST="/etc/fail2ban/ip.whitelist"
NFT_CONF="/etc/nftables.conf"
JAIL_CONF="/etc/fail2ban/jail.d/asterisk.conf"
JAIL_NAME="asterisk"

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Execute como root: sudo manage-fw $*"

validate_ip() {
    local ip=$1
    [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?$ ]] || return 1
    local base; base=$(cut -d/ -f1 <<< "$ip")
    IFS='.' read -ra A <<< "$base"
    for i in "${A[@]}"; do [[ $i -le 255 ]] || return 1; done
    return 0
}

# Atualiza elements = { ... } no nftables.conf e recarrega
rebuild_nft_whitelist() {
    local elements
    elements=$(grep -v '^[[:space:]]*#\|^[[:space:]]*$' "$WHITELIST" 2>/dev/null \
        | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g' || true)

    sed -i '/set whitelist {/,/^    }/{/elements = {/d}' "$NFT_CONF"

    if [[ -n "$elements" ]]; then
        sed -i "/flags interval/a\\        elements = { ${elements} }" "$NFT_CONF"
    fi

    nft -f "$NFT_CONF" 2>/dev/null && log "nftables recarregado" || warn "Falha ao recarregar nftables"
}

reload_fail2ban() {
    if [[ -f "$JAIL_CONF" ]]; then
        local wl; wl=$(grep -v '^[[:space:]]*#\|^[[:space:]]*$' "$WHITELIST" 2>/dev/null | tr '\n' ' ' || true)
        sed -i "s|^ignoreip.*|ignoreip  = 127.0.0.1/8 ::1 ${wl}|" "$JAIL_CONF"
        fail2ban-client reload &>/dev/null && log "Fail2Ban recarregado" || warn "Fail2Ban não recarregou"
    fi
}

cmd_add() {
    local ip=$1
    validate_ip "$ip" || err "IP inválido: $ip  (ex: 1.2.3.4 ou 10.0.0.0/24)"

    if grep -qxF "$ip" "$WHITELIST" 2>/dev/null; then
        warn "$ip já está na whitelist"
    else
        echo "$ip" >> "$WHITELIST"
        log "$ip adicionado"
    fi

    nft add element inet filter whitelist { $ip } 2>/dev/null || true
    rebuild_nft_whitelist
    reload_fail2ban
    fail2ban-client set "$JAIL_NAME" unbanip "$ip" &>/dev/null || true

    echo ""
    echo -e "${GREEN}✓ $ip liberado — acesso às portas SIP/RTP permitido${NC}"
}

cmd_remove() {
    local ip=$1
    validate_ip "$ip" || err "IP inválido: $ip"

    if grep -qxF "$ip" "$WHITELIST" 2>/dev/null; then
        sed -i "\|^${ip}$|d" "$WHITELIST"
        log "$ip removido"
    else
        warn "$ip não está na whitelist"
        return 0
    fi

    nft delete element inet filter whitelist { $ip } 2>/dev/null || true
    rebuild_nft_whitelist
    reload_fail2ban

    # Sem isso, conexões UDP já estabelecidas (conntrack ASSURED) continuam passando
    # pela regra "ct state established,related accept" mesmo depois do IP sair da whitelist
    if command -v conntrack &>/dev/null; then
        conntrack -D -s "$ip" &>/dev/null || true
        conntrack -D -d "$ip" &>/dev/null || true
        log "Conntrack limpo para $ip"
    fi

    echo ""
    echo -e "${GREEN}✓ $ip removido — acesso bloqueado${NC}"
}

cmd_list() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}Whitelist — IPs com acesso liberado${NC}"
    echo -e "${CYAN}══════════════════════════════════════════${NC}"

    if [[ ! -f "$WHITELIST" ]] || ! grep -qv '^[[:space:]]*#\|^[[:space:]]*$' "$WHITELIST" 2>/dev/null; then
        echo -e "  ${YELLOW}(vazia — portas SIP/RTP bloqueadas para todos)${NC}"
    else
        grep -v '^[[:space:]]*#\|^[[:space:]]*$' "$WHITELIST" | while read -r ip; do
            echo -e "  ${GREEN}●${NC} $ip"
        done
    fi

    echo ""
    echo -e "${CYAN}  Set nftables atual:${NC}"
    nft list set inet filter whitelist 2>/dev/null \
        | grep -E 'elements|^}' \
        | sed 's/^/    /' \
        || echo -e "    ${YELLOW}(set não encontrado)${NC}"

    echo ""
    echo -e "${CYAN}  Banidos atualmente (Fail2Ban):${NC}"
    banned=$(fail2ban-client status asterisk 2>/dev/null | grep "Banned IP" | cut -d: -f2 | tr ' ' '\n' | grep -v '^$' || true)
    if [[ -z "$banned" ]]; then
        echo -e "    ${GREEN}(nenhum)${NC}"
    else
        echo "$banned" | while read -r ip; do
            echo -e "    ${RED}✗${NC} $ip"
        done
    fi
    echo ""
}

CMD="${1:-}"
IP="${2:-}"

case "$CMD" in
    add)
        [[ -n "$IP" ]] || err "Uso: manage-fw add <IP[/CIDR]>"
        cmd_add "$IP"
        ;;
    remove|rm)
        [[ -n "$IP" ]] || err "Uso: manage-fw remove <IP[/CIDR]>"
        cmd_remove "$IP"
        ;;
    list|ls)
        cmd_list
        ;;
    *)
        echo -e "${BOLD}Uso:${NC} manage-fw {add|remove|list} [IP]"
        echo ""
        echo "  add    <IP>  — libera IP nas portas SIP/RTP"
        echo "  remove <IP>  — bloqueia IP"
        echo "  list         — whitelist + set nftables + banidos"
        echo ""
        echo "  Suporta CIDR: manage-fw add 10.0.0.0/24"
        exit 1
        ;;
esac
MANAGE_FW_EOF

chmod +x /usr/local/sbin/manage-fw
log "manage-fw instalado em /usr/local/sbin/manage-fw"

# ============================================================
# STEP 13 - SINCRONIZAR .ENV DO BACKEND
# Versão do Asterisk define as portas SIP/PJSIP (ver ASTERISK_VERSION/PJSIP_PORT/SIP_PORT
# em src/config/env.ts) — o backend expõe isso pro frontend via GET /system/sip-config.
# ============================================================
show_header
show_progress 13 13 "Sincronizando configuração com o backend"

set_env_var() {
    local file=$1 key=$2 value=$3
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

echo -ne "${CYAN}→${NC} Caminho do .env do backend [/opt/sofon-pabx/backend/.env] (Enter p/ pular): "
read -r BACKEND_ENV_FILE

if [[ -n "$BACKEND_ENV_FILE" && -f "$BACKEND_ENV_FILE" ]]; then
    set_env_var "$BACKEND_ENV_FILE" "ASTERISK_VERSION" "$ASTERISK_VERSION"
    set_env_var "$BACKEND_ENV_FILE" "SIP_LEGACY_ENABLED" "$USE_LEGACY_SIP"
    set_env_var "$BACKEND_ENV_FILE" "PJSIP_PORT" "$PJSIP_PORT"
    [[ "$USE_LEGACY_SIP" == true ]] && set_env_var "$BACKEND_ENV_FILE" "SIP_PORT" "$SIP_PORT"
    log "Backend .env atualizado (${BACKEND_ENV_FILE}) — reinicie o serviço do backend para aplicar"
else
    warn "Backend .env não localizado — adicione manualmente:"
    echo "    ASTERISK_VERSION=${ASTERISK_VERSION}"
    echo "    SIP_LEGACY_ENABLED=${USE_LEGACY_SIP}"
    echo "    PJSIP_PORT=${PJSIP_PORT}"
    [[ "$USE_LEGACY_SIP" == true ]] && echo "    SIP_PORT=${SIP_PORT}"
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
if [[ "$USE_LEGACY_SIP" == true ]]; then
    echo -e "  SIP        : ${CYAN}${SIP_PORT}${NC} (UDP/TCP)"
    echo -e "  PJSIP      : ${CYAN}${PJSIP_PORT}${NC} (UDP/TCP)"
else
    echo -e "  PJSIP      : ${CYAN}${PJSIP_PORT}${NC} (UDP/TCP)"
fi
echo -e "  RTP        : ${CYAN}10000-20000${NC} (UDP)"
echo -e "  Proxy Web  : ${CYAN}80, 443${NC} (HTTP/HTTPS) + ${CYAN}81${NC} (painel Nginx Proxy Manager)"
echo -e "  AMI Secret : ${YELLOW}${AMI_SECRET}${NC}"
echo -e "  Fail2Ban   : ${GREEN}ativo${NC}"
echo -e "  manage-fw  : ${GREEN}/usr/local/sbin/manage-fw${NC}"
echo -e "  Log        : ${CYAN}${LOG_FILE}${NC}"
echo ""
echo -e "  Liberar acesso às portas SIP/RTP:"
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