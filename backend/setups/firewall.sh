#!/bin/bash
# firewall.sh — nftables + Fail2Ban with IP access control (whitelist)
# Usage: sudo bash firewall.sh [OPTIONS]
#
# SECURITY MODEL
#   - SSH (--ssh): always open to everyone (prevents lockout)
#   - TCP 80/443: open to everyone by default (--tcp-public adds more)
#   - App ports (--tcp, --udp, --udp-range, --tcp-range): whitelist IPs only
#   - --local-tcp: 127.0.0.1 only
#   - Docker: preserved (add table, no global flush; FORWARD: accept)
#   - Empty whitelist = app ports blocked for everyone until manage-fw add <IP>
#
# EXAMPLES
#   # Asterisk PJSIP + RTP + AMI + Fail2Ban
#   sudo bash firewall.sh \
#     --tcp 5060 --udp 5060 \
#     --udp-range 10000-20000 \
#     --local-tcp 5038 \
#     --extra-ssh 21122 \
#     --fail2ban \
#     --jail-name asterisk \
#     --jail-ports 5060 \
#     --jail-logpath /var/log/asterisk/messages \
#     --jail-filter /etc/fail2ban/filter.d/asterisk.conf
#
#   # Simple web server
#   sudo bash firewall.sh --tcp 80,443
#
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# ── Defaults ──────────────────────────────────────────────────────────────────
CONFIG_DIR="/etc/manage-fw"
CONFIG_FILE="$CONFIG_DIR/config.args"
LOG_FILE="/var/log/manage-fw.log"
SSH_PORT=22
EXTRA_SSH_PORT=""
TCP_PORTS=()
UDP_PORTS=()
TCP_RANGES=()
UDP_RANGES=()
TCP_PUBLIC_PORTS=(80 443)
UDP_PUBLIC_PORTS=()
TCP_PUBLIC_RANGES=()
UDP_PUBLIC_RANGES=()
LOCAL_TCP_PORTS=()
PRIVATE_TCP_PORTS=()
PRIVATE_UDP_PORTS=()
readonly PRIVATE_RANGES="10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16"

ENABLE_FAIL2BAN=false
JAIL_NAME="app"
JAIL_PORTS=""
JAIL_LOGPATH=""
JAIL_FILTER_FILE=""
JAIL_MAXRETRY=3
JAIL_FINDTIME=300
JAIL_BANTIME=86400

# ── Help ──────────────────────────────────────────────────────────────────────
usage() {
cat << 'EOF'
USAGE
  sudo bash firewall.sh [OPTIONS]

NETWORK
  --ssh PORT            SSH port (default: 22) — always public, never blocked
  --extra-ssh PORT      Second SSH port (e.g.: 21122) — also always public
  --tcp PORTS           TCP port(s) — comma-separated or repeated flag
                          e.g.: --tcp 80,443  or  --tcp 80 --tcp 443
                          ACCESS: whitelist IPs only
  --tcp-public PORTS    TCP port(s) open to everyone (no whitelist)
                          default: 80, 443 (always added; extra ports append)
                          e.g.: --tcp-public 8080  (adds 8080 to 80/443)
  --udp PORTS           UDP port(s) — same format
                          ACCESS: whitelist IPs only
  --udp-public PORTS    UDP port(s) open to everyone (no whitelist)
                          e.g.: --udp-public 443  (HTTP/3 QUIC)
  --tcp-range N-M       TCP range (e.g.: --tcp-range 8000-9000)
                          ACCESS: whitelist IPs only
  --tcp-range-public N-M  TCP range open to everyone
  --udp-range N-M       UDP range (e.g.: --udp-range 10000-20000)
                          ACCESS: whitelist IPs only
  --udp-range-public N-M  UDP range open to everyone
  --local-tcp PORT      TCP port accessible from 127.0.0.1 only (repeatable)
  --private-tcp PORT    TCP port accessible from private/RFC1918 networks only
                          (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) — repeatable
                          e.g.: backend port reachable from LAN/Docker, never internet
  --private-udp PORT    UDP port, same as --private-tcp (repeatable)

FAIL2BAN  (requires --fail2ban to enable)
  --fail2ban            Install and configure Fail2Ban
  --jail-name NAME      Jail name (default: app)
  --jail-ports PORTS    Protected ports (default: derived from --tcp/--udp)
  --jail-logpath PATH   Log file to monitor (required with --fail2ban)
  --jail-filter FILE    Pre-existing filter .conf (or writes a generic filter)
  --jail-maxretry N     Attempts before ban (default: 3)
  --jail-findtime N     Detection window in seconds (default: 300)
  --jail-bantime N      Ban duration in seconds (default: 86400 = 24h)

OTHER
  --log FILE            Script log file (default: /var/log/manage-fw.log)
  --update              Reapply using the saved config (from the last run)
                          plus any extra flags given — preserves whitelist,
                          fail2ban bans and existing options automatically.
                          e.g.: firewall.sh --update --udp-range 30000-31000
  --reload              Reload the current nftables ruleset only. Does not
                          install packages, rewrite config, or change ports.
  --help                Show this help

BACKUP
  Every run backs up the previous /etc/nftables.conf to
  /etc/manage-fw/backups/ before overwriting it, and writes a diff listing
  any ports/IPs that existed there but aren't covered by this run's flags
  (they will be removed unless re-added). Check the warnings in the log,
  or read /etc/manage-fw/backups/diff-<timestamp>.txt.

ACCESS POLICY
  INPUT:   DROP by default
  SSH:     open to everyone (safety — prevents lockout)
  Public:  TCP 80/443 open by default, plus --tcp-public / --udp-public
  App:     --tcp / --udp only IPs added via manage-fw
  Private: --private-tcp / --private-udp open to RFC1918 networks only
  Docker:  tables preserved (add table, no global flush)
  FORWARD: ACCEPT (Docker requires this)
  OUTPUT:  ACCEPT

manage-fw  (installed at /usr/local/sbin/manage-fw)
  manage-fw add <IP>     Allow IP on app ports (nftables + Fail2Ban)
  manage-fw remove <IP>  Remove IP access
  manage-fw list         List allowed IPs + banned
  manage-fw reload       Reapply nftables + Fail2Ban and restore Docker

  Supports CIDR: manage-fw add 10.0.0.0/24
  IPv4 only.
EOF
    exit 0
}

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${GREEN}[+]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Must run as root: sudo bash $0 $*"

reload_firewall() {
    [[ -f /etc/nftables.conf ]] || err "Ruleset not found: /etc/nftables.conf"

    touch "$LOG_FILE"
    log "Reloading nftables ruleset"
    nft -f /etc/nftables.conf >> "$LOG_FILE" 2>&1 || err "Failed to reload nftables rules"

    # Reloading nftables removes Docker's MASQUERADE rules.
    if systemctl is-active --quiet docker 2>/dev/null; then
        warn "Docker detected - restarting to restore NAT rules (MASQUERADE)..."
        systemctl restart docker >> "$LOG_FILE" 2>&1 || warn "Failed to restart Docker"
    fi

    log "nftables ruleset reloaded"
}

if [[ "$#" -eq 1 && "$1" == "--reload" ]]; then
    reload_firewall
    exit 0
fi

append_ports() {
    local -n _arr=$1
    IFS=',' read -ra _parts <<< "$2"
    for p in "${_parts[@]}"; do _arr+=("$p"); done
}

nft_set() {
    local items=("$@")
    [[ ${#items[@]} -eq 1 ]] && echo "${items[0]}" || (IFS=', '; echo "{ ${items[*]} }")
}

# Before overwriting /etc/nftables.conf, back it up and warn about ports/IPs
# that were in it but aren't covered by the flags of this run — otherwise a
# manually-added rule (or a config from before this run's flags) silently
# disappears on the next `flush table inet filter`.
BACKUP_DIR="/etc/manage-fw/backups"
backup_and_diff_nftables_conf() {
    local old_conf="/etc/nftables.conf"
    [[ -f "$old_conf" ]] || return 0

    mkdir -p "$BACKUP_DIR"
    local ts backup_file
    ts=$(date +%Y%m%d-%H%M%S)
    backup_file="$BACKUP_DIR/nftables.conf.${ts}.bak"
    cp "$old_conf" "$backup_file"
    log "Previous nftables.conf backed up to $backup_file"

    local old_ports old_ips
    old_ports=$(grep -oE 'dport (\{[^}]*\}|[0-9]+(-[0-9]+)?)' "$old_conf" \
        | grep -oE '[0-9]+(-[0-9]+)?' | sort -un)
    old_ips=$(grep -oE 'ip saddr (\{[^}]*\}|[0-9]{1,3}(\.[0-9]{1,3}){3}(/[0-9]{1,2})?)' "$old_conf" \
        | grep -oE '[0-9]{1,3}(\.[0-9]{1,3}){3}(/[0-9]{1,2})?' \
        | grep -v '^127\.0\.0\.1$' | sort -u || true)

    local new_ports=("$SSH_PORT")
    [[ -n "$EXTRA_SSH_PORT" ]] && new_ports+=("$EXTRA_SSH_PORT")
    new_ports+=(
        "${TCP_PORTS[@]}" "${UDP_PORTS[@]}"
        "${TCP_PUBLIC_PORTS[@]}" "${UDP_PUBLIC_PORTS[@]}"
        "${TCP_RANGES[@]}" "${UDP_RANGES[@]}"
        "${TCP_PUBLIC_RANGES[@]}" "${UDP_PUBLIC_RANGES[@]}"
        "${LOCAL_TCP_PORTS[@]}" "${PRIVATE_TCP_PORTS[@]}" "${PRIVATE_UDP_PORTS[@]}"
    )

    local missing=()
    local p np found
    for p in $old_ports; do
        found=false
        for np in "${new_ports[@]}"; do
            [[ "$p" == "$np" ]] && { found=true; break; }
        done
        [[ "$found" == false ]] && missing+=("$p")
    done

    {
        echo "# Snapshot before overwrite — $(date)"
        echo "# Ports found in the previous nftables.conf but NOT covered by this run's flags:"
        echo "${missing[*]:-(none)}"
        echo "# IP/CIDR literals found in the previous nftables.conf (outside @whitelist, 127.0.0.1):"
        echo "${old_ips:-(none)}"
    } > "$BACKUP_DIR/diff-${ts}.txt"

    if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Ports in the OLD nftables.conf not covered by current flags — will be REMOVED: ${missing[*]}"
        warn "Re-add them with matching --tcp/--udp/--tcp-public/etc flags if still needed."
    fi
    if [[ -n "$old_ips" ]]; then
        warn "IP/CIDR literals found in the OLD nftables.conf (outside whitelist): ${old_ips//$'\n'/, }"
    fi
    log "Full diff saved to $BACKUP_DIR/diff-${ts}.txt"
}

# ── Update mode: reuse config saved on a previous run ────────────────────────
UPDATE_MODE=false
NEW_ARGS=()
for a in "$@"; do
    if [[ "$a" == "--update" ]]; then
        UPDATE_MODE=true
    else
        NEW_ARGS+=("$a")
    fi
done

if [[ "$UPDATE_MODE" == true ]]; then
    [[ -f "$CONFIG_FILE" ]] || err "No saved config at $CONFIG_FILE — run firewall.sh once without --update first"
    EXTRA_ARGS_STR=""
    [[ ${#NEW_ARGS[@]} -gt 0 ]] && EXTRA_ARGS_STR=$(printf '%q ' "${NEW_ARGS[@]}")
    eval "set -- $(cat "$CONFIG_FILE") $EXTRA_ARGS_STR"
    if [[ ${#NEW_ARGS[@]} -gt 0 ]]; then
        log "Update mode: reusing saved config ($CONFIG_FILE), plus new flags: ${NEW_ARGS[*]}"
    else
        log "Update mode: reusing saved config ($CONFIG_FILE)"
    fi
else
    set -- "${NEW_ARGS[@]}"
fi

# ── Parse args ────────────────────────────────────────────────────────────────
[[ $# -eq 0 ]] && usage

ARGS_SNAPSHOT=("$@")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)        usage ;;
        --log)            LOG_FILE="$2";           shift 2 ;;
        --ssh)            SSH_PORT="$2";            shift 2 ;;
        --extra-ssh)      EXTRA_SSH_PORT="$2";      shift 2 ;;
        --tcp)              append_ports TCP_PORTS "$2";        shift 2 ;;
        --tcp-public)       append_ports TCP_PUBLIC_PORTS "$2"; shift 2 ;;
        --udp)              append_ports UDP_PORTS "$2";        shift 2 ;;
        --udp-public)       append_ports UDP_PUBLIC_PORTS "$2"; shift 2 ;;
        --tcp-range)        TCP_RANGES+=("$2");                 shift 2 ;;
        --tcp-range-public) TCP_PUBLIC_RANGES+=("$2");          shift 2 ;;
        --udp-range)        UDP_RANGES+=("$2");                 shift 2 ;;
        --udp-range-public) UDP_PUBLIC_RANGES+=("$2");          shift 2 ;;
        --local-tcp)      LOCAL_TCP_PORTS+=("$2");  shift 2 ;;
        --private-tcp)    PRIVATE_TCP_PORTS+=("$2"); shift 2 ;;
        --private-udp)    PRIVATE_UDP_PORTS+=("$2"); shift 2 ;;
        --fail2ban)       ENABLE_FAIL2BAN=true;     shift ;;
        --jail-name)      JAIL_NAME="$2";            shift 2 ;;
        --jail-ports)     JAIL_PORTS="$2";           shift 2 ;;
        --jail-logpath)   JAIL_LOGPATH="$2";         shift 2 ;;
        --jail-filter)    JAIL_FILTER_FILE="$2";     shift 2 ;;
        --jail-maxretry)  JAIL_MAXRETRY="$2";        shift 2 ;;
        --jail-findtime)  JAIL_FINDTIME="$2";        shift 2 ;;
        --jail-bantime)   JAIL_BANTIME="$2";         shift 2 ;;
        *) err "Unknown argument: $1  (use --help)" ;;
    esac
done

[[ "$ENABLE_FAIL2BAN" == true && -z "$JAIL_LOGPATH" ]] && \
    err "--jail-logpath is required when --fail2ban is active"

# Persist the effective args so `--update` can replay them later without
# the caller having to remember the original invocation.
mkdir -p "$CONFIG_DIR"
printf '%q ' "${ARGS_SNAPSHOT[@]}" > "$CONFIG_FILE"
echo >> "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

touch "$LOG_FILE"

echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}manage-fw — Firewall Configuration${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"

# ── STEP 1: nftables ──────────────────────────────────────────────────────────
log "Installing nftables"

if command -v ufw &>/dev/null; then
    ufw disable >> "$LOG_FILE" 2>&1 || true
    systemctl disable ufw >> "$LOG_FILE" 2>&1 || true
    log "UFW disabled"
fi

DEBIAN_FRONTEND=noninteractive apt-get install -y nftables conntrack >> "$LOG_FILE" 2>&1 \
    || err "Failed to install nftables"

mkdir -p /etc/fail2ban
[[ -f /etc/fail2ban/ip.whitelist ]] || touch /etc/fail2ban/ip.whitelist

# Read existing whitelist to populate the initial set
INITIAL_ELEMENTS=$(grep -v '^[[:space:]]*#\|^[[:space:]]*$' /etc/fail2ban/ip.whitelist 2>/dev/null \
    | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g' || true)

backup_and_diff_nftables_conf

{
    echo '#!/usr/sbin/nft -f'
    echo ''
    echo '# Recreates only our table — preserves Docker tables'
    echo 'add table inet filter'
    echo 'flush table inet filter'
    echo ''
    echo 'table inet filter {'
    echo ''
    # Named set for IP whitelist — flags interval = supports CIDR
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
    # SSH: always open (prevents lockout)
    if [[ -n "$EXTRA_SSH_PORT" ]]; then
        echo "        tcp dport { ${SSH_PORT}, ${EXTRA_SSH_PORT} } accept"
    else
        echo "        tcp dport ${SSH_PORT} accept"
    fi
    echo ''
    # Public ports: open to everyone
    if [[ ${#TCP_PUBLIC_PORTS[@]} -gt 0 ]]; then
        echo "        tcp dport $(nft_set "${TCP_PUBLIC_PORTS[@]}") accept"
    fi
    if [[ ${#UDP_PUBLIC_PORTS[@]} -gt 0 ]]; then
        echo "        udp dport $(nft_set "${UDP_PUBLIC_PORTS[@]}") accept"
    fi
    for r in "${TCP_PUBLIC_RANGES[@]}"; do
        echo "        tcp dport ${r} accept"
    done
    for r in "${UDP_PUBLIC_RANGES[@]}"; do
        echo "        udp dport ${r} accept"
    done
    # App ports: whitelist only
    if [[ ${#TCP_PORTS[@]} -gt 0 ]]; then
        echo "        ip saddr @whitelist tcp dport $(nft_set "${TCP_PORTS[@]}") accept"
    fi
    if [[ ${#UDP_PORTS[@]} -gt 0 ]]; then
        echo "        ip saddr @whitelist udp dport $(nft_set "${UDP_PORTS[@]}") accept"
    fi
    for r in "${TCP_RANGES[@]}"; do
        echo "        ip saddr @whitelist tcp dport ${r} accept"
    done
    for r in "${UDP_RANGES[@]}"; do
        echo "        ip saddr @whitelist udp dport ${r} accept"
    done
    # Local ports: 127.0.0.1 only
    for p in "${LOCAL_TCP_PORTS[@]}"; do
        echo "        ip saddr 127.0.0.1 tcp dport ${p} accept"
    done
    # Private ports: RFC1918 networks only (LAN/Docker, never internet-facing)
    for p in "${PRIVATE_TCP_PORTS[@]}"; do
        echo "        ip saddr { ${PRIVATE_RANGES} } tcp dport ${p} accept"
    done
    for p in "${PRIVATE_UDP_PORTS[@]}"; do
        echo "        ip saddr { ${PRIVATE_RANGES} } udp dport ${p} accept"
    done
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

nft -f /etc/nftables.conf >> "$LOG_FILE" 2>&1 || err "Failed to apply nftables rules"
systemctl enable nftables >> "$LOG_FILE" 2>&1 || true
log "nftables configured — app ports restricted to whitelist"

# Docker loses MASQUERADE rules when nftables is reloaded
if systemctl is-active --quiet docker 2>/dev/null; then
    warn "Docker detected — restarting to restore NAT rules (MASQUERADE)..."
    systemctl restart docker >> "$LOG_FILE" 2>&1 || warn "Failed to restart Docker"
    log "Docker restarted — MASQUERADE rules restored"
fi

# `systemctl restart nftables` flushes Docker's dynamically-created NAT rules.
# Restore Docker automatically after every nftables service restart.
mkdir -p /etc/systemd/system/nftables.service.d
cat > /etc/systemd/system/nftables.service.d/docker-restore.conf << 'EOF'
[Service]
ExecStartPost=-/usr/bin/systemctl try-restart docker
EOF
systemctl daemon-reload >> "$LOG_FILE" 2>&1 || warn "Failed to reload systemd daemon"
log "nftables Docker restore drop-in configured"

# ── STEP 2: Fail2Ban (optional) ───────────────────────────────────────────────
if [[ "$ENABLE_FAIL2BAN" == true ]]; then
    log "Configuring Fail2Ban"

    DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban >> "$LOG_FILE" 2>&1 \
        || warn "Fail2Ban not installed"

    mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d /etc/fail2ban/action.d

    # FIX: the stock nftables-allports action only blocks TCP (meta l4proto tcp),
    # ignoring UDP even with protocol=udp,tcp in the jail. Own action: blocks by
    # IP with no protocol restriction.
    if [[ -n "$EXTRA_SSH_PORT" ]]; then
        SSH_EXEMPT_SET="{ ${SSH_PORT}, ${EXTRA_SSH_PORT} }"
    else
        SSH_EXEMPT_SET="${SSH_PORT}"
    fi
    # This chain hooks at "filter - 1" — it runs BEFORE the main inet filter
    # chain, so its drop rule bypasses the "SSH always accept" rule there.
    # Without this exemption, a ban on this jail (e.g.: your own IP shares a
    # NAT/VPN with an offending client) blocks SSH too, locking you out.
    cat > "/etc/fail2ban/action.d/nftables-${JAIL_NAME}.conf" << EOF
[Definition]
actionstart = nft add table inet f2b-<name>
              nft add set inet f2b-<name> addr-set-<name> { type ipv4_addr\; }
              nft add chain inet f2b-<name> f2b-chain { type filter hook input priority filter - 1\; }
              nft insert rule inet f2b-<name> f2b-chain tcp dport ${SSH_EXEMPT_SET} accept
              nft add rule inet f2b-<name> f2b-chain ip saddr @addr-set-<name> drop

actionstop = nft delete table inet f2b-<name>

actioncheck = nft list table inet f2b-<name> >/dev/null 2>&1

actionban = nft add element inet f2b-<name> addr-set-<name> { <ip> }

actionunban = nft delete element inet f2b-<name> addr-set-<name> { <ip> }

[Init]
name = default
EOF

    if [[ -n "$JAIL_FILTER_FILE" ]]; then
        [[ -f "$JAIL_FILTER_FILE" ]] || err "Filter not found: $JAIL_FILTER_FILE"
        cp "$JAIL_FILTER_FILE" "/etc/fail2ban/filter.d/${JAIL_NAME}.conf"
        log "Filter copied from $JAIL_FILTER_FILE"
    else
        cat > "/etc/fail2ban/filter.d/${JAIL_NAME}.conf" << 'EOF'
[Definition]
failregex = authentication failure.*rhost=<HOST>
            Failed .* from <HOST>
            Invalid user .* from <HOST>

ignoreregex =
EOF
        warn "Generic filter written — adjust /etc/fail2ban/filter.d/${JAIL_NAME}.conf"
    fi

    if [[ -z "$JAIL_PORTS" ]]; then
        ALL_PORTS=("${TCP_PORTS[@]}" "${UDP_PORTS[@]}")
        [[ ${#ALL_PORTS[@]} -gt 0 ]] \
            && JAIL_PORTS=$(IFS=','; echo "${ALL_PORTS[*]}") \
            || JAIL_PORTS="0:65535"
    fi

    WHITELIST=$(grep -v '^#\|^$' /etc/fail2ban/ip.whitelist 2>/dev/null | tr '\n' ' ' || true)

    cat > "/etc/fail2ban/jail.d/${JAIL_NAME}.conf" << EOF
[${JAIL_NAME}]
enabled   = true
port      = ${JAIL_PORTS}
protocol  = udp,tcp
filter    = ${JAIL_NAME}
logpath   = ${JAIL_LOGPATH}
maxretry  = ${JAIL_MAXRETRY}
findtime  = ${JAIL_FINDTIME}
bantime   = ${JAIL_BANTIME}
ignoreip  = 127.0.0.1/8 ::1 ${WHITELIST}
action    = nftables-${JAIL_NAME}[name=${JAIL_NAME}]
EOF

    systemctl enable fail2ban >> "$LOG_FILE" 2>&1 || true
    systemctl restart fail2ban >> "$LOG_FILE" 2>&1 || warn "Fail2Ban failed to restart"

    sleep 2
    while IFS= read -r ip; do
        [[ "$ip" =~ ^#|^$ ]] && continue
        fail2ban-client set "${JAIL_NAME}" unbanip "$ip" >> "$LOG_FILE" 2>&1 || true
    done < /etc/fail2ban/ip.whitelist
    log "Fail2Ban active — jail: ${JAIL_NAME}"
fi

# ── STEP 3: manage-fw ─────────────────────────────────────────────────────────
log "Installing manage-fw"

JAIL_NAME_SAVED="$JAIL_NAME"
ENABLE_F2B_SAVED="$ENABLE_FAIL2BAN"

cat > /usr/local/sbin/manage-fw << MANAGE_FW_EOF
#!/bin/bash
# manage-fw — manages IP whitelist in nftables + Fail2Ban
# Usage: manage-fw {add|remove|list} [IP[/CIDR]]

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

WHITELIST="/etc/fail2ban/ip.whitelist"
NFT_CONF="/etc/nftables.conf"
JAIL_CONF="/etc/fail2ban/jail.d/${JAIL_NAME_SAVED}.conf"
JAIL_NAME="${JAIL_NAME_SAVED}"
FAIL2BAN="${ENABLE_F2B_SAVED}"

log()  { echo -e "\${GREEN}[+]\${NC} \$1"; }
warn() { echo -e "\${YELLOW}[!]\${NC} \$1"; }
err()  { echo -e "\${RED}[x]\${NC} \$1" >&2; exit 1; }

[[ \$EUID -eq 0 ]] || err "Must run as root: sudo manage-fw \$*"

validate_ip() {
    local ip=\$1
    # Accepts IPv4 with or without CIDR
    [[ \$ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?\$ ]] || return 1
    local base; base=\$(cut -d/ -f1 <<< "\$ip")
    IFS='.' read -ra A <<< "\$base"
    for i in "\${A[@]}"; do [[ \$i -le 255 ]] || return 1; done
    return 0
}

# Keeps /etc/nftables.conf in sync on disk (for persistence across reboot).
# Does NOT call nft -f: the caller already updates the live kernel set with
# nft add/delete element, so no reload is needed. A full nft -f re-applies
# the whole file (flush + recreate table inet filter), which drops Docker's
# MASQUERADE/NAT rules — see firewall.sh's own STEP 1 comment. Avoiding the
# reload here means manage-fw add/remove never disrupts container networking.
rebuild_nft_whitelist() {
    local elements
    elements=\$(grep -v '^[[:space:]]*#\|^[[:space:]]*\$' "\$WHITELIST" 2>/dev/null \
        | tr '\n' ',' | sed 's/,\$//' | sed 's/,/, /g' || true)

    # Remove existing elements line inside the set whitelist block
    sed -i '/set whitelist {/,/^    }/{/elements = {/d}' "\$NFT_CONF"

    # Insert elements line after flags interval if there are IPs
    if [[ -n "\$elements" ]]; then
        sed -i "/flags interval/a\\        elements = { \${elements} }" "\$NFT_CONF"
    fi
}

reload_fail2ban() {
    [[ "\$FAIL2BAN" != true ]] && return 0
    if [[ -f "\$JAIL_CONF" ]]; then
        local wl; wl=\$(grep -v '^[[:space:]]*#\|^[[:space:]]*\$' "\$WHITELIST" 2>/dev/null | tr '\n' ' ' || true)
        sed -i "s|^ignoreip.*|ignoreip  = 127.0.0.1/8 ::1 \${wl}|" "\$JAIL_CONF"
        fail2ban-client reload &>/dev/null && log "Fail2Ban reloaded" || warn "Fail2Ban failed to reload"
    fi
}

cmd_add() {
    local ip=\$1
    validate_ip "\$ip" || err "Invalid IP: \$ip  (e.g.: 1.2.3.4 or 10.0.0.0/24)"

    if grep -qxF "\$ip" "\$WHITELIST" 2>/dev/null; then
        warn "\$ip is already in the whitelist"
    else
        echo "\$ip" >> "\$WHITELIST"
        log "\$ip added"
    fi

    # Update nftables live + conf
    nft add element inet filter whitelist { \$ip } 2>/dev/null || true
    rebuild_nft_whitelist

    # Fail2Ban: unban and update ignoreip
    reload_fail2ban
    if [[ "\$FAIL2BAN" == true ]] && command -v fail2ban-client &>/dev/null; then
        fail2ban-client set "\$JAIL_NAME" unbanip "\$ip" &>/dev/null || true
    fi

    echo ""
    echo -e "\${GREEN}✓ \$ip allowed — access to app ports granted\${NC}"
}

cmd_remove() {
    local ip=\$1
    validate_ip "\$ip" || err "Invalid IP: \$ip"

    if grep -qxF "\$ip" "\$WHITELIST" 2>/dev/null; then
        sed -i "\\|^\${ip}\$|d" "\$WHITELIST"
        log "\$ip removed"
    else
        warn "\$ip is not in the whitelist"
        return 0
    fi

    # Update nftables live + conf
    nft delete element inet filter whitelist { \$ip } 2>/dev/null || true
    rebuild_nft_whitelist

    reload_fail2ban

    # Without this, already-established UDP connections (conntrack ASSURED) keep
    # passing through "ct state established,related accept" even after the IP
    # leaves the whitelist
    if command -v conntrack &>/dev/null; then
        conntrack -D -s "\$ip" &>/dev/null || true
        conntrack -D -d "\$ip" &>/dev/null || true
        log "Conntrack cleared for \$ip"
    fi

    echo ""
    echo -e "\${GREEN}✓ \$ip removed — access blocked\${NC}"
}

cmd_reload() {
    [[ -f "\$NFT_CONF" ]] || err "Ruleset not found: \$NFT_CONF"

    nft -f "\$NFT_CONF" &>/dev/null && log "nftables reloaded" || err "Failed to reload nftables"
    reload_fail2ban

    if systemctl is-active --quiet docker 2>/dev/null; then
        systemctl try-restart docker &>/dev/null || warn "Failed to restart Docker"
        log "Docker restored"
    fi

    echo ""
    echo -e "\${GREEN}✓ nftables and Fail2Ban reloaded\${NC}"
}

cmd_list() {
    echo ""
    echo -e "\${CYAN}══════════════════════════════════════════\${NC}"
    echo -e "  \${BOLD}Whitelist — IPs with access granted\${NC}"
    echo -e "\${CYAN}══════════════════════════════════════════\${NC}"

    if [[ ! -f "\$WHITELIST" ]] || ! grep -qv '^[[:space:]]*#\|^[[:space:]]*\$' "\$WHITELIST" 2>/dev/null; then
        echo -e "  \${YELLOW}(empty — app ports blocked for everyone)\${NC}"
    else
        grep -v '^[[:space:]]*#\|^[[:space:]]*\$' "\$WHITELIST" | while read -r ip; do
            echo -e "  \${GREEN}●\${NC} \$ip"
        done
    fi

    # Confirm what nftables has in memory
    echo ""
    echo -e "\${CYAN}  Current nftables set:\${NC}"
    nft list set inet filter whitelist 2>/dev/null \
        | grep -E 'elements|^}' \
        | sed 's/^/    /' \
        || echo -e "  \${YELLOW}  (set not found — run firewall.sh)\${NC}"

    if [[ "\$FAIL2BAN" == true ]] && command -v fail2ban-client &>/dev/null; then
        echo ""
        echo -e "\${CYAN}  Currently banned (jail: \$JAIL_NAME):\${NC}"
        banned=\$(fail2ban-client status "\$JAIL_NAME" 2>/dev/null \
            | grep "Banned IP" | cut -d: -f2 | tr ' ' '\n' | grep -v '^\$' || true)
        if [[ -z "\$banned" ]]; then
            echo -e "    \${GREEN}(none)\${NC}"
        else
            echo "\$banned" | while read -r ip; do
                echo -e "    \${RED}✗\${NC} \$ip"
            done
        fi
    fi
    echo ""
}

CMD="\${1:-}"
IP="\${2:-}"

case "\$CMD" in
    add)
        [[ -n "\$IP" ]] || err "Usage: manage-fw add <IP[/CIDR]>"
        cmd_add "\$IP"
        ;;
    remove|rm)
        [[ -n "\$IP" ]] || err "Usage: manage-fw remove <IP[/CIDR]>"
        cmd_remove "\$IP"
        ;;
    list|ls)
        cmd_list
        ;;
    reload)
        cmd_reload
        ;;
    *)
        echo -e "\${BOLD}Usage:\${NC} manage-fw {add|remove|list|reload} [IP]"
        echo ""
        echo "  add    <IP>  — allow IP on app ports"
        echo "  remove <IP>  — block IP"
        echo "  list         — whitelist + nftables set + banned"
        echo "  reload       — reapply nftables + Fail2Ban"
        echo ""
        echo "  Supports CIDR: manage-fw add 10.0.0.0/24"
        exit 1
        ;;
esac
MANAGE_FW_EOF

chmod +x /usr/local/sbin/manage-fw
log "manage-fw installed at /usr/local/sbin/manage-fw"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✓ Firewall configured${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  nftables   : ${GREEN}active${NC}"
[[ "$ENABLE_FAIL2BAN" == true ]] && echo -e "  Fail2Ban   : ${GREEN}active (jail: ${JAIL_NAME})${NC}"
echo -e "  manage-fw  : ${GREEN}/usr/local/sbin/manage-fw${NC}"
echo -e "  Whitelist  : ${CYAN}/etc/fail2ban/ip.whitelist${NC}"
echo -e "  Log        : ${CYAN}${LOG_FILE}${NC}"
if [[ ${#TCP_PUBLIC_PORTS[@]} -gt 0 || ${#UDP_PUBLIC_PORTS[@]} -gt 0 || ${#TCP_PUBLIC_RANGES[@]} -gt 0 || ${#UDP_PUBLIC_RANGES[@]} -gt 0 ]]; then
    echo ""
    echo -e "  ${GREEN}Public ports (open to everyone):${NC}"
    [[ ${#TCP_PUBLIC_PORTS[@]} -gt 0 ]]   && echo -e "    TCP : ${TCP_PUBLIC_PORTS[*]}"
    [[ ${#UDP_PUBLIC_PORTS[@]} -gt 0 ]]   && echo -e "    UDP : ${UDP_PUBLIC_PORTS[*]}"
    [[ ${#TCP_PUBLIC_RANGES[@]} -gt 0 ]]  && echo -e "    TCP ranges : ${TCP_PUBLIC_RANGES[*]}"
    [[ ${#UDP_PUBLIC_RANGES[@]} -gt 0 ]]  && echo -e "    UDP ranges : ${UDP_PUBLIC_RANGES[*]}"
fi
if [[ ${#PRIVATE_TCP_PORTS[@]} -gt 0 || ${#PRIVATE_UDP_PORTS[@]} -gt 0 ]]; then
    echo ""
    echo -e "  ${GREEN}Private ports (RFC1918 networks only):${NC}"
    [[ ${#PRIVATE_TCP_PORTS[@]} -gt 0 ]]  && echo -e "    TCP : ${PRIVATE_TCP_PORTS[*]}"
    [[ ${#PRIVATE_UDP_PORTS[@]} -gt 0 ]]  && echo -e "    UDP : ${PRIVATE_UDP_PORTS[*]}"
fi
echo ""
echo -e "  ${YELLOW}WARNING:${NC} app ports blocked until IPs are added:"
echo -e "    ${YELLOW}manage-fw add <YOUR_IP>${NC}       → grants access"
echo -e "    ${YELLOW}manage-fw add 10.0.0.0/24${NC}    → allows CIDR block"
echo -e "    ${YELLOW}manage-fw remove <IP>${NC}         → blocks"
echo -e "    ${YELLOW}manage-fw list${NC}                → full status"
echo ""
echo -e "  SSH (port ${SSH_PORT}${EXTRA_SSH_PORT:+ and $EXTRA_SSH_PORT}) remains open to everyone."
echo ""
