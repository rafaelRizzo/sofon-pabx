#!/bin/bash
# ============================================================
# REMOVEDOR SOFON PBX / ASTERISK - NATIVO
# Debian 11+ | Ubuntu 24.04+
# ============================================================

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

LOG_FILE="/var/log/sofon-uninstall.log"

log()  { echo -e "${GREEN}[+]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

show_header() {
    clear
    echo ""
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}REMOVEDOR SOFON PBX / ASTERISK${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo ""
}

[[ $EUID -eq 0 ]] || err "Execute como root: sudo $0"
touch "$LOG_FILE"
show_header

# ============================================================
# CONFIRMAÇÃO
# ============================================================
echo -e "${RED}${BOLD}  ATENÇÃO: Esta operação é irreversível!${NC}"
echo ""
echo -e "  Sempre removido:"
echo -e "    ${YELLOW}•${NC} Asterisk (binários, serviço, módulos)"
echo -e "    ${YELLOW}•${NC} Configurações em /etc/asterisk"
echo -e "    ${YELLOW}•${NC} Logs em /var/log/asterisk"
echo -e "    ${YELLOW}•${NC} Spool em /var/spool/asterisk"
echo -e "    ${YELLOW}•${NC} Libs em /usr/lib/asterisk"
echo -e "    ${YELLOW}•${NC} Fontes em /usr/src/asterisk-*"
echo -e "    ${YELLOW}•${NC} Usuário asterisk"
echo -e "    ${YELLOW}•${NC} Logrotate asterisk"
echo ""
echo -e "  Opcional (perguntado abaixo):"
echo -e "    ${CYAN}•${NC} manage-fw + Fail2Ban jail/filter do Asterisk"
echo -e "    ${CYAN}•${NC} Firewall nftables (reset + política permissiva)"
echo -e "    ${CYAN}•${NC} ip.whitelist (/etc/fail2ban/ip.whitelist)"
echo ""
echo -ne "  ${BOLD}Deseja manter backup das configs?${NC} [S/n]: "
read -r KEEP_BACKUP
echo ""
echo -ne "  ${BOLD}Remover firewall (nftables + Fail2Ban + manage-fw)?${NC} [s/N]: "
read -r REMOVE_FW
echo ""
echo -ne "${RED}  Confirma remoção completa?${NC} Digite ${BOLD}REMOVER${NC}: "
read -r CONFIRM
echo ""

[[ "$CONFIRM" == "REMOVER" ]] || { echo -e "${YELLOW}✗ Cancelado.${NC}"; exit 0; }

# ============================================================
# BACKUP CONFIGS (opcional)
# ============================================================
BACKUP_DIR=""
if [[ ! $KEEP_BACKUP =~ ^[Nn]$ ]] && [[ -d /etc/asterisk ]]; then
    BACKUP_DIR="/root/asterisk-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r /etc/asterisk "$BACKUP_DIR/" 2>/dev/null || true
    log "Backup salvo em: $BACKUP_DIR"
fi

# ============================================================
# 1. PARAR SERVIÇO
# ============================================================
log "Parando Asterisk..."
systemctl stop asterisk    >> "$LOG_FILE" 2>&1 || true
systemctl disable asterisk >> "$LOG_FILE" 2>&1 || true
if pgrep -x asterisk &>/dev/null; then
    warn "Processo ainda ativo, forçando encerramento..."
    killall -9 asterisk >> "$LOG_FILE" 2>&1 || true
    sleep 2
fi
log "Serviço parado"

# ============================================================
# 2. REMOVER SERVIÇO
# ============================================================
log "Removendo serviço..."
for f in \
    /lib/systemd/system/asterisk.service \
    /etc/systemd/system/asterisk.service \
    /etc/init.d/asterisk \
    /etc/default/asterisk; do
    [[ -f "$f" ]] && rm -f "$f" && log "  Removido: $f"
done
systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true

# ============================================================
# 3. REMOVER BINÁRIOS
# ============================================================
log "Removendo binários..."
for f in \
    /usr/sbin/asterisk \
    /usr/sbin/astcanary \
    /usr/sbin/astdb2sqlite3 \
    /usr/sbin/astdb2bdb \
    /usr/sbin/rasterisk \
    /usr/sbin/astgenkey \
    /usr/sbin/autosupport \
    /usr/sbin/safe_asterisk; do
    [[ -f "$f" ]] && rm -f "$f" && log "  Removido: $f"
done

# ============================================================
# 4. REMOVER DIRETÓRIOS
# ============================================================
log "Removendo diretórios..."
for dir in \
    /etc/asterisk \
    /var/log/asterisk \
    /var/spool/asterisk \
    /var/lib/asterisk \
    /var/run/asterisk \
    /usr/lib/asterisk \
    /usr/share/asterisk; do
    [[ -d "$dir" ]] && rm -rf "$dir" && log "  Removido: $dir"
done

# ============================================================
# 5. REMOVER FONTES
# ============================================================
log "Removendo fontes compiladas..."
for d in /usr/src/asterisk-*; do
    [[ -d "$d" ]] && rm -rf "$d" && log "  Removido: $d"
done
rm -f /usr/src/asterisk-*.tar.gz 2>/dev/null || true

# ============================================================
# 6. REMOVER LOGROTATE
# ============================================================
rm -f /etc/logrotate.d/asterisk 2>/dev/null || true
log "Logrotate removido"

# ============================================================
# 7. REMOVER USUÁRIO
# ============================================================
if id asterisk &>/dev/null; then
    userdel -r asterisk >> "$LOG_FILE" 2>&1 || userdel asterisk >> "$LOG_FILE" 2>&1 || true
    log "Usuário asterisk removido"
fi
groupdel asterisk >> "$LOG_FILE" 2>&1 || true

# ============================================================
# 8. REMOVER MANAGE-FW + FAIL2BAN + NFTABLES (opcional)
# ============================================================
if [[ $REMOVE_FW =~ ^[SsYy]$ ]]; then

    rm -f /usr/local/sbin/manage-fw 2>/dev/null && log "  Removido: /usr/local/sbin/manage-fw" || true

    log "Removendo configurações Fail2Ban do Asterisk..."
    for f in \
        /etc/fail2ban/jail.d/asterisk.conf \
        /etc/fail2ban/filter.d/asterisk.conf; do
        [[ -f "$f" ]] && rm -f "$f" && log "  Removido: $f"
    done

    if command -v fail2ban-client &>/dev/null && systemctl is-active --quiet fail2ban 2>/dev/null; then
        fail2ban-client reload >> "$LOG_FILE" 2>&1 || true
        log "Fail2Ban recarregado"
    fi

    echo -ne "  ${BOLD}Remover ip.whitelist?${NC} [s/N]: "
    read -r DEL_WL
    if [[ $DEL_WL =~ ^[SsYy]$ ]]; then
        rm -f /etc/fail2ban/ip.whitelist && log "  Removido: /etc/fail2ban/ip.whitelist"
    else
        log "  ip.whitelist preservado"
    fi

    log "Resetando firewall (nftables)..."
    if command -v nft &>/dev/null; then
        nft delete table inet filter >> "$LOG_FILE" 2>&1 || true
        printf '#!/usr/sbin/nft -f\n\nadd table inet filter\nflush table inet filter\n' > /etc/nftables.conf
        systemctl disable nftables >> "$LOG_FILE" 2>&1 || true
        log "nftables resetado — tabela inet filter removida, Docker preservado"
    else
        warn "nft não encontrado — firewall não resetado"
    fi

else
    log "Firewall preservado (manage-fw, Fail2Ban e nftables mantidos)"
fi

# ============================================================
# SUMÁRIO
# ============================================================
show_header
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✓ REMOÇÃO CONCLUÍDA!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
[[ -n "$BACKUP_DIR" ]] && echo -e "  Backup   : ${CYAN}${BACKUP_DIR}${NC}"
echo -e "  Log      : ${CYAN}${LOG_FILE}${NC}"
echo ""
echo -e "  Verificações:"
echo -e "    Binário  : $(command -v asterisk 2>/dev/null || echo 'não encontrado ✓')"
echo -e "    Serviço  : $(systemctl is-active asterisk 2>/dev/null || echo 'inativo ✓')"
echo -e "    Processo : $(pgrep -x asterisk &>/dev/null && echo 'ainda rodando !' || echo 'nenhum ✓')"
if [[ $REMOVE_FW =~ ^[SsYy]$ ]]; then
    echo -e "    Firewall : $(nft list tables 2>/dev/null | grep -c 'table' || echo 0) tabela(s) nft restantes"
else
    echo -e "    Firewall : preservado"
fi
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
