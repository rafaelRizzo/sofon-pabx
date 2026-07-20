#!/bin/bash
# ============================================================
# SOFON PBX - PostgreSQL Realtime Setup
# Configura ODBC + Realtime para PJSIP, SIP legado e IAX2
# ============================================================

set -uo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly RED='\033[0;31m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

LOG_FILE="/var/log/sofon-realtime.log"

log()  { echo -e "${GREEN}[+]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

show_header() {
    clear
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}SOFON PBX - PostgreSQL Realtime Setup${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
    echo ""
}

[[ $EUID -eq 0 ]] || err "Execute como root: sudo $0"
touch "$LOG_FILE"
show_header

# ============================================================
# VARIÁVEIS
# ============================================================
PG_HOST="127.0.0.1"
PG_PORT="5433"
PG_ADMIN="postgres"
PG_DB="asterisk"
PG_USER="asterisk"
PG_PASS=""
DOCKER_CONTAINER="postgres_sofon"

# ============================================================
# HELPERS PSQL
# FIX: pg_admin opera no DB padrão (postgres) — usado para DDL global
#      pg_admin_db opera explicitamente no DB asterisk — usado para GRANT em schema/tables
# ============================================================
pg_admin()    { docker exec "$DOCKER_CONTAINER" psql -U "$PG_ADMIN" "$@"; }
pg_admin_db() { docker exec "$DOCKER_CONTAINER" psql -U "$PG_ADMIN" -d "$PG_DB" "$@"; }

# ============================================================
# COLETA DE DADOS
# ============================================================
# Senha gerada automaticamente — só usada internamente (role do Postgres + odbc.ini/res_odbc.conf,
# ambos lidos só pelo Asterisk); ninguém precisa digitar nem guardar esse valor.
PG_PASS="$(openssl rand -base64 24)"

echo -e "${BOLD}Configuração do PostgreSQL:${NC}"
echo ""
echo -e "  Host      : ${CYAN}${PG_HOST}:${PG_PORT}${NC}"
echo -e "  Container : ${CYAN}${DOCKER_CONTAINER}${NC}"
echo -e "  Database  : ${CYAN}${PG_DB}${NC}"
echo -e "  Usuário   : ${CYAN}${PG_USER}${NC} (senha gerada automaticamente)"
echo ""
echo -ne "  Confirma? [s/N]: "
read -r REPLY
[[ $REPLY =~ ^[SsYy]$ ]] || { echo -e "${RED}✗${NC} Cancelado."; exit 0; }

# ============================================================
# STEP 1 - DEPENDÊNCIAS ODBC
# ============================================================
show_header
echo -e "${BOLD}[1/5]${NC} Instalando dependências ODBC..."
echo ""
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    unixodbc unixodbc-dev odbc-postgresql >> "$LOG_FILE" 2>&1 \
    || err "Falha ao instalar ODBC"
log "ODBC instalado"

# ============================================================
# STEP 2 - CRIAR USUÁRIO E DATABASE
# FIX: GRANT em schema e tabelas usa pg_admin_db (-d asterisk)
#      para garantir que opera no DB correto e não no postgres
# ============================================================
show_header
echo -e "${BOLD}[2/5]${NC} Criando usuário e database..."
echo ""

# Usuário — opera no catálogo global (sem -d, correto)
USER_EXISTS=$(pg_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}';" 2>>"$LOG_FILE" || true)
if [[ "$USER_EXISTS" == "1" ]]; then
    pg_admin -c "ALTER USER ${PG_USER} WITH PASSWORD '${PG_PASS}';" >> "$LOG_FILE" 2>&1 || true
    log "Usuário '${PG_USER}' já existe — senha atualizada"
else
    pg_admin -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';" >> "$LOG_FILE" 2>&1 \
        || err "Falha ao criar usuário"
    log "Usuário '${PG_USER}' criado"
fi

# Database — GRANT ON DATABASE opera no catálogo global (sem -d, correto)
DB_EXISTS=$(pg_admin -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}';" 2>>"$LOG_FILE" || true)
if [[ "$DB_EXISTS" == "1" ]]; then
    log "Database '${PG_DB}' já existe"
else
    pg_admin -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" >> "$LOG_FILE" 2>&1 \
        || err "Falha ao criar database"
    log "Database '${PG_DB}' criada"
fi

# GRANT ON DATABASE — catálogo global, pg_admin sem -d
pg_admin -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true

# FIX: GRANT ON SCHEMA e ALTER SCHEMA precisam rodar no contexto do DB asterisk
pg_admin_db -c "GRANT ALL ON SCHEMA public TO ${PG_USER};"   >> "$LOG_FILE" 2>&1 || true
pg_admin_db -c "ALTER SCHEMA public OWNER TO ${PG_USER};"    >> "$LOG_FILE" 2>&1 || true

# FIX: ALTER DEFAULT PRIVILEGES faz o grant persistir pra tabelas FUTURAS criadas
# pelo ${PG_ADMIN} (usuário do Prisma) — sem isso, toda migration que recria uma
# tabela derruba os grants do asterisk e exige correção manual de novo
pg_admin_db -c "ALTER DEFAULT PRIVILEGES FOR ROLE ${PG_ADMIN} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true

# FIX: sequences (colunas @default(autoincrement()), ex: cdr.id) não são cobertas pelo
# default privilege de TABLES acima — sem isso, INSERT falha com "permission denied for
# sequence" mesmo com a tabela já liberada
pg_admin_db -c "ALTER DEFAULT PRIVILEGES FOR ROLE ${PG_ADMIN} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true
pg_admin_db -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true

log "Privilégios concedidos"

# ============================================================
# STEP 3 - CONFIGURAR ODBC
# ============================================================
show_header
echo -e "${BOLD}[3/5]${NC} Configurando ODBC..."
echo ""

PG_DRIVER=$(find /usr/lib -name "psqlodbcw.so" 2>/dev/null | head -1 || \
            find /usr/lib -name "psqlodbc.so"  2>/dev/null | head -1 || \
            find /usr/lib -name "*psql*odbc*"  2>/dev/null | head -1 || true)
[[ -z "$PG_DRIVER" ]] && err "Driver ODBC PostgreSQL não encontrado"
log "Driver: $PG_DRIVER"

cat > /etc/odbcinst.ini << EOF
[PostgreSQL]
Description = PostgreSQL ODBC Driver
Driver      = ${PG_DRIVER}
Setup       = ${PG_DRIVER}
FileUsage   = 1
EOF

cat > /etc/odbc.ini << EOF
[asterisk]
Description          = Asterisk PostgreSQL Realtime
Driver               = PostgreSQL
Servername           = ${PG_HOST}
Server               = ${PG_HOST}
Port                 = ${PG_PORT}
Database             = ${PG_DB}
UserName             = ${PG_USER}
Password             = ${PG_PASS}
Protocol             = 9.4
ReadOnly             = No
UseServerSidePrepare = 1
BoolsAsChar          = 0
EOF

log "ODBC configurado"

echo "quit" | isql -v asterisk "$PG_USER" "$PG_PASS" >> "$LOG_FILE" 2>&1 \
    && log "DSN testado: OK" \
    || warn "DSN falhou — verifique $LOG_FILE"

# ============================================================
# STEP 4 - CONFIGURAR ASTERISK
# FIX: extconfig.conf inclui mapeamento da tabela extensions
#      para que switch => Realtime/ funcione no dialplan
# ============================================================
show_header
echo -e "${BOLD}[4/5]${NC} Configurando Asterisk realtime..."
echo ""

cat > /etc/asterisk/res_odbc.conf << EOF
[asterisk]
enabled     => yes
dsn         => asterisk
username    => ${PG_USER}
password    => ${PG_PASS}
pre-connect => yes
EOF

# FIX: adicionado "extensions" para suportar switch => Realtime/ no dialplan
# FIX: ps_endpoint_id_ips é o nome de família que res_pjsip_endpoint_identifier_ip espera —
#      mapeado pra nossa tabela real ps_identifies via 3º argumento
cat > /etc/asterisk/extconfig.conf << 'EOF'
[settings]
ps_endpoints       => odbc,asterisk,ps_endpoints
ps_auths           => odbc,asterisk,ps_auths
ps_aors            => odbc,asterisk,ps_aors
ps_contacts        => odbc,asterisk,ps_contacts
ps_endpoint_id_ips => odbc,asterisk,ps_identifies
ps_registrations   => odbc,asterisk,ps_registrations
sippeers           => odbc,asterisk,sip_peers
sipregs            => odbc,asterisk,sip_peers
iaxpeers           => odbc,asterisk,iax_friends
iaxusers           => odbc,asterisk,iax_friends
voicemail          => odbc,asterisk,voicemail_users
extensions         => odbc,asterisk,extensions
queues             => odbc,asterisk,queues
queue_members      => odbc,asterisk,queue_members
EOF

cat > /etc/asterisk/sorcery.conf << 'EOF'
[res_pjsip]
endpoint => realtime,ps_endpoints
auth => realtime,ps_auths
aor => realtime,ps_aors
contact => realtime,ps_contacts

[res_pjsip_endpoint_identifier_ip]
identify = realtime,ps_endpoint_id_ips

[res_pjsip_outbound_registration]
registration => realtime,ps_registrations
EOF

cat > /etc/asterisk/sorcery_memory_cache.conf << 'EOF'
[ps_endpoints]
object_lifetime_maximum=60
expire_on_reload=yes

[ps_auths]
object_lifetime_maximum=60
expire_on_reload=yes

[ps_aors]
object_lifetime_maximum=60
expire_on_reload=yes

[ps_contacts]
object_lifetime_maximum=60
expire_on_reload=yes
EOF

# CDR direto no Postgres via ODBC — tabela cdr usa os nomes de coluna nativos do Asterisk
# (dcontext, clid, channel, dstchannel, lastapp, lastdata, start, answer, accountcode), exceto
# "end", que é palavra reservada no Postgres (CASE...END) e quebra o INSERT sem aspas — por isso
# a coluna física é "endtime" e precisa do alias abaixo.
cat > /etc/asterisk/cdr.conf << 'EOF'
[general]
enable=yes
unanswered=yes
congestion=yes
endbeforehexten=no
EOF

cat > /etc/asterisk/cdr_adaptive_odbc.conf << 'EOF'
[asterisk]
connection=asterisk
table=cdr
alias end => endtime
EOF

# Garante que res_odbc e res_config_odbc carregam antes do res_pjsip no startup
# Sem isso, o sorcery 'identify' (ps_identifies) falha ao inicializar
MODULES_CONF="/etc/asterisk/modules.conf"
if ! grep -q "preload => res_odbc.so" "$MODULES_CONF" 2>/dev/null; then
    sed -i '/^autoload=yes/a preload => res_odbc.so\npreload => res_config_odbc.so' "$MODULES_CONF"
    log "modules.conf: preload res_odbc + res_config_odbc adicionado"
else
    log "modules.conf: preload já configurado"
fi

chown asterisk:asterisk \
    /etc/asterisk/res_odbc.conf \
    /etc/asterisk/extconfig.conf \
    /etc/asterisk/sorcery.conf \
    /etc/asterisk/sorcery_memory_cache.conf \
    /etc/asterisk/cdr.conf \
    /etc/asterisk/cdr_adaptive_odbc.conf
chmod 640 \
    /etc/asterisk/res_odbc.conf \
    /etc/asterisk/extconfig.conf \
    /etc/asterisk/sorcery.conf \
    /etc/asterisk/sorcery_memory_cache.conf \
    /etc/asterisk/cdr.conf \
    /etc/asterisk/cdr_adaptive_odbc.conf

log "Configurações Asterisk criadas"

# ============================================================
# STEP 5 - AGUARDA PRISMA E RECARREGA ASTERISK
# ============================================================
show_header
echo -e "${BOLD}[5/5]${NC} Aguardando Prisma migrate e recarregando Asterisk..."
echo ""

echo -e "  ${YELLOW}Execute agora em outro terminal:${NC}"
echo -e "    prisma migrate deploy"
echo ""
echo -ne "  Prisma migrate concluído? [s/N]: "
read -r MIGRATED
[[ $MIGRATED =~ ^[SsYy]$ ]] || { warn "Pule e execute manualmente os próximos passos."; }

if [[ $MIGRATED =~ ^[SsYy]$ ]]; then
    # Corrige owner de TODAS as tabelas via loop (tabelas criadas pelo Prisma)
    log "Corrigindo owner das tabelas (loop automático)..."
    docker exec "$DOCKER_CONTAINER" psql -U "$PG_ADMIN" -d "$PG_DB" << ENDSQL >> "$LOG_FILE" 2>&1
DO \$\$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tableowner != '${PG_USER}'
    LOOP
        EXECUTE 'ALTER TABLE ' || tbl || ' OWNER TO ${PG_USER}';
    END LOOP;
END;
\$\$;
ENDSQL

    # ALTER TABLE explícito nas tabelas críticas do Asterisk
    log "Aplicando ALTER TABLE explícito nas tabelas Asterisk..."
    docker exec "$DOCKER_CONTAINER" psql -U "$PG_ADMIN" -d "$PG_DB" << ENDSQL2 >> "$LOG_FILE" 2>&1
ALTER TABLE IF EXISTS extensions      OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_aors         OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_auths        OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_contacts     OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_endpoints    OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS sip_peers       OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS iax_friends     OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS voicemail_users OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS queues          OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS queue_members   OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_identifies    OWNER TO ${PG_USER};
ALTER TABLE IF EXISTS ps_registrations OWNER TO ${PG_USER};

ENDSQL2
    log "Owner das tabelas corrigido"

    # GRANT explícito nas tabelas que já existem agora (default privileges só
    # cobre tabelas criadas DEPOIS deste ponto)
    log "Aplicando GRANT nas tabelas existentes..."
    pg_admin_db -c "GRANT USAGE ON SCHEMA public TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true
    pg_admin_db -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true
    pg_admin_db -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PG_USER};" >> "$LOG_FILE" 2>&1 || true
    log "Grants aplicados"
fi

# Restart incondicional — cdr.conf, cdr_adaptive_odbc.conf, sorcery.conf, extconfig.conf e
# res_odbc.conf foram escritos no STEP 4 independente da resposta acima, e um simples
# "module reload" não é suficiente pra ativar o subsistema de CDR pela primeira vez.
systemctl restart asterisk >> "$LOG_FILE" 2>&1 || err "Falha ao reiniciar Asterisk"
sleep 4
asterisk -rx 'module reload res_odbc.so'        >> "$LOG_FILE" 2>&1 || true
asterisk -rx 'module reload res_config_odbc.so' >> "$LOG_FILE" 2>&1 || true
asterisk -rx 'module reload res_pjsip.so'       >> "$LOG_FILE" 2>&1 || true
sleep 2
log "Asterisk recarregado"

ENDPOINTS=$(asterisk -rx 'pjsip show endpoints' 2>/dev/null | grep -c 'Endpoint:' || echo "0")
log "Endpoints PJSIP detectados: ${ENDPOINTS}"

# ============================================================
# SUMÁRIO
# ============================================================
show_header
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✓ REALTIME CONFIGURADO!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  PostgreSQL : ${CYAN}${PG_HOST}:${PG_PORT}/${PG_DB}${NC}"
echo -e "  Usuário    : ${CYAN}${PG_USER}${NC}"
echo -e "  DSN ODBC   : ${CYAN}asterisk${NC}"
echo -e "  Log        : ${CYAN}${LOG_FILE}${NC}"
echo ""
echo -e "  ${BOLD}Se ainda não rodou o Prisma, execute na ordem:${NC}"
echo -e "    ${YELLOW}1. prisma migrate deploy${NC}"
echo -e "    ${YELLOW}2. systemctl restart asterisk${NC}"
echo -e "    ${YELLOW}3. asterisk -rx 'module reload res_odbc.so'${NC}"
echo -e "    ${YELLOW}4. asterisk -rx 'module reload res_pjsip.so'${NC}"
echo ""
echo -e "  Verificações:"
echo -e "    ${YELLOW}asterisk -rx 'odbc show all'${NC}"
echo -e "    ${YELLOW}asterisk -rx 'pjsip show endpoints'${NC}"
echo -e "    ${YELLOW}asterisk -rx 'sip show peers'${NC}"
echo -e "    ${YELLOW}asterisk -rx 'dialplan show ramais'${NC}"
echo ""
echo -e "  ${BOLD}Tabelas que devem pertencer ao usuário '${PG_USER}':${NC}"
echo -e "  ${CYAN}(execute manualmente se o Prisma criar com owner errado)${NC}"
echo ""
echo -e "    ${YELLOW}ALTER TABLE extensions      OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE ps_aors         OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE ps_auths        OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE ps_contacts     OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE ps_endpoints    OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE sip_peers       OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE iax_friends     OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE voicemail_users OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE queues          OWNER TO ${PG_USER};${NC}"
echo -e "    ${YELLOW}ALTER TABLE queue_members   OWNER TO ${PG_USER};${NC}"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"