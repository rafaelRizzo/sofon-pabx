import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { validateEnv } from '../../config/env'
import { withDialplanLock } from './dialplan-file.repository'

const env = validateEnv()

// Esqueleto global do dialplan: hoje [ramais]/[transfer]/[from-trunk]/[from-trunk-routed] e os
// #tryinclude de dialplan-extra só existem porque o instalador (setups/install-asterisk.sh)
// escreveu direto em /etc/asterisk/extensions.conf uma única vez, na instalação - o backend nunca
// toca nesse arquivo. Se ele for perdido (reinstalação parcial, disco, erro humano), a PABX inteira
// para mesmo com banco/dialplan-extra intactos, e só um rerun manual do instalador resolve. Extraído
// pra arquivo próprio (sofon-managed.conf), incluído por extensions.conf via `#include`, pra que
// ensureBaseDialplan() abaixo consiga se auto-curar sem precisar reaplicar o script inteiro.
export const BASE_DIALPLAN_PATH = `${env.ASTERISK_CONF_DIR}/sofon-managed.conf`
export const EXTENSIONS_CONF_PATH = `${env.ASTERISK_CONF_DIR}/extensions.conf`
const BASE_DIALPLAN_INCLUDE = '#include sofon-managed.conf'

// ATENÇÃO: espelha o heredoc de sofon-managed.conf gerado por setups/install-asterisk.sh -
// os dois precisam ser atualizados juntos manualmente, não há geração compartilhada entre eles hoje.
const BASE_DIALPLAN_CONTENT = `; AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
; Gerado por Sofon PABX (src/asterisk/base-dialplan.repository.ts).
; Sobrescrito sempre que ensureBaseDialplan() detectar drift (arquivo ausente ou com
; conteúdo diferente do esperado, ex: reinstalação parcial do Asterisk).
; Espelha setups/install-asterisk.sh - qualquer mudança precisa acontecer nos dois lugares.

[ramais]
; Delega lookup de ramais para Realtime (tabela extensions no PostgreSQL)
; Suporta qualquer formato de exten: 1001, 2002_16824d1144, etc.
switch => Realtime/ramais@extensions

; Fallbacks locais - não conflitam pois são extens exatos, não padrões
exten => *97,1,VoiceMailMain(\${CALLERID(num)}@default)
exten => *43,1,Answer()
 same => n,Echo()
exten => *60,1,Answer()
 same => n,MusicOnHold()

; TRANSFER_CONTEXT das chamadas inbound (ver inboundroute.repository.ts) - resolvido em tempo real
; via AGI pro ramal OU fila da MESMA empresa (CHANNEL(accountcode)), sem precisar saber de antemão
; se o dígito discado na transferência é um ramal ou um número de fila. O AGI já faz "EXEC Goto"
; pro destino certo quando encontra (ver handleTransferRoute em agi-server.ts) - o Congestion()
; abaixo só roda quando ele NÃO encontra nada (AGI retorna sem ter dado Goto). Nesse ponto o
; \`t\`/\`T\` do Dial/Queue já dropou a outra perna (agente) nativamente antes do redirect - não
; tem bridge original pra restaurar, então o melhor possível é encerrar a chamada do cliente de
; forma previsível, em vez de Congestion() sem argumento (que toca o tom indefinidamente até o
; cliente desligar manualmente).
[transfer]
exten => _X.,1,NoOp(Transferencia solicitada: \${EXTEN})
 same => n,Set(TRANSFERRED=1)
; Tagueia direction=transfer JÁ nesse ponto (antes do AGI) - esse fork de CDR acontece pro
; canal do CLIENTE assim que o \`t\`/\`T\` do Dial/Queue dispara o redirect nativo, então mesmo
; quando o AGI abaixo não encontra destino (ramal offline/inexistente) e cai no Congestion(),
; esse segmento não fica marcado como "inbound" - sem isso ele aparecia na tabela de CDR como
; uma 2ª chamada de entrada "duplicada" (mesmo linkedid/uniqueid da chamada original)
 same => n,Set(CDR(direction)=transfer)
 same => n,AGI(agi://127.0.0.1:4573/transfer-route)
 same => n,Congestion(3)

[default]
exten => s,1,Hangup()

[from-trunk]
; Todas as trunks inbound compartilham esse contexto (ps_endpoints.context=from-trunk).
; Roteia por CHANNEL(accountcode) (= Company.asteriskId, setado em todo endpoint/friend), não por
; TRUNKID: quando 2 trunks da MESMA empresa compartilham host/IP (operadora com várias contas SIP
; no mesmo IP), o Asterisk pode identificar o endpoint errado (ps_identifies ambíguo por IP) mesmo
; a chamada entrando certa - TRUNKID (setvar do endpoint) viria do trunk errado. accountcode não
; sofre disso: é idêntico nos 2 endpoints ambíguos (mesma empresa), então a rota acerta mesmo assim.
exten => _X.,1,Goto(from-trunk-routed,\${EXTEN}_\${CHANNEL(accountcode)},1)

[from-trunk-routed]
; Delega lookup de rotas de entrada para Realtime (tabela extensions no PostgreSQL)
; exten gravado como <didNumber>_<companyAsteriskId> por InboundRouteRepository
switch => Realtime/from-trunk-routed@extensions

; DID sem rota cadastrada - cause 1 (Unallocated number) -> PJSIP responde 404 Not Found
; HANGUPCAUSE é função read-only (\${HANGUPCAUSE}); a cause real só é setada via argumento do Hangup()
; FIX: NÃO declarar um catch-all _X. estático aqui - padrão estático tem prioridade
; sobre "switch => Realtime/..." no mesmo contexto, então _X. bloquearia TODA rota
; realtime válida (qualquer exten <didNumber>_<companyAsteriskId> começa com dígito). O "i"
; já cobre o caso de nenhuma rota (estática ou realtime) ser encontrada.
exten => i,1,Noop(DID sem rota: \${EXTEN})
 same => n,Hangup(1)

; queues-app, timeconditions, announcements, ivrs, holidays, request-templates, ixc-nodes, formatters,
; variables, variable-conditions, callcenter-surveys e flows/flow-nodes são contextos compartilhados de BAIXA
; escrita (só mudam por CRUD via API, nunca por ligação) - materializados em arquivo estático por
; empresa em /etc/asterisk/dialplan-extra/<contexto>/<asteriskId>.conf (ver dialplan-file.repository.ts).
; #tryinclude (não #include) - não erra quando a empresa ainda não gerou nenhum .conf pra esse
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
`

// rename() atômico no mesmo filesystem - mesmo padrão de writeContextFile (dialplan-file.repository.ts),
// evita o Asterisk ler o arquivo pela metade num reload concorrente.
async function writeBaseDialplan() {
    await mkdir(dirname(BASE_DIALPLAN_PATH), { recursive: true })
    const tmpPath = `${BASE_DIALPLAN_PATH}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, BASE_DIALPLAN_CONTENT, 'utf8')
    await rename(tmpPath, BASE_DIALPLAN_PATH)
}

// Instalações antigas tinham todos os contextos diretamente em extensions.conf, sem o include do
// arquivo gerenciado. Acrescenta somente o include ausente, preservando integralmente a configuração
// manual já existente. Não exige reinstalação do Asterisk.
async function ensureBaseDialplanIncluded(): Promise<boolean> {
    const current = await readFile(EXTENSIONS_CONF_PATH, 'utf8').catch(() => null)
    if (current?.match(/^\s*#include\s+"?sofon-managed\.conf"?\s*$/mi)) return false

    const content = current == null
        ? `[general]\nstatic=yes\nwriteprotect=no\n\n[globals]\nLANGUAGE=pt_BR\n\n${BASE_DIALPLAN_INCLUDE}\n`
        : `${current.trimEnd()}\n\n; Sofon PABX, contextos gerenciados\n${BASE_DIALPLAN_INCLUDE}\n`
    await mkdir(dirname(EXTENSIONS_CONF_PATH), { recursive: true })
    const tmpPath = `${EXTENSIONS_CONF_PATH}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, content, 'utf8')
    await rename(tmpPath, EXTENSIONS_CONF_PATH)
    return true
}

// Idempotente: só escreve quando o arquivo está ausente ou com conteúdo diferente do esperado -
// chamado antes de qualquer resync de empresa (companies.service.ts), que já faz o reload final via
// reloadDialplanNow(), então essa função não dispara reload própria. Retorna true só quando
// efetivamente reescreveu (drift detectado e corrigido), false quando já estava correto.
export async function ensureBaseDialplan(): Promise<boolean> {
    return withDialplanLock('sofon-managed', async () => {
        const current = await readFile(BASE_DIALPLAN_PATH, 'utf8').catch(() => null)
        const baseDialplanRewritten = current !== BASE_DIALPLAN_CONTENT
        if (baseDialplanRewritten) await writeBaseDialplan()
        const includeAdded = await ensureBaseDialplanIncluded()
        return baseDialplanRewritten || includeAdded
    })
}
