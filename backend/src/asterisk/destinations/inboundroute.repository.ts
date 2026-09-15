import { prisma } from '../../lib/prisma'
import type { InboundDest } from '../../modules/inbound-routes/schemas/inbound-route.schema'
import { ROUTING_TRUNK_VAR, recordingFilenameSuffix } from '../dialplan/dialplan-names'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function resolveDestination(dest: InboundDest): Promise<{ app: string; appdata: string | null }> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? { app: 'Goto', appdata: `${target.context},${target.exten},${target.priority}` } : { app: 'Hangup', appdata: null }
}

// contexto único compartilhado por todas as trunks - ps_endpoints.context de toda trunk inbound
export const TRUNK_ENTRY_CONTEXT = 'from-trunk'
// contexto onde o dialplan real é resolvido, já com TRUNKID (setvar do endpoint) embutido no exten -
// isola trunks/empresas diferentes mesmo quando o mesmo número de DID é reusado entre elas
export const TRUNK_ROUTED_CONTEXT = 'from-trunk-routed'

// Chave de roteamento é <did>_<companyAsteriskId>, não <did>_<trunkId>. Motivo: o Asterisk
// resolve qual endpoint recebeu a chamada ANTES do dialplan (ps_identifies, por IP/host) - quando
// 2 trunks da MESMA empresa compartilham host/IP (operadora com várias contas SIP no mesmo IP,
// caso comum), essa resolução é ambígua e não-determinística (ver PjsipRepository.syncIdentify),
// então ${TRUNKID} (setvar do endpoint) pode vir do trunk errado mesmo a chamada tendo entrado
// corretamente. ${CHANNEL(accountcode)} (= Company.asteriskId, setado em TODO endpoint/friend, ver
// PjsipRepository/IaxRepository createTrunk) não sofre disso: é IDÊNTICO nos 2 endpoints
// ambíguos (mesma empresa), então a chave de roteamento acerta mesmo com o TRUNKID errado.
// trunkId continua correto pra CDR(trunk_id)/GROUP()/ROUTING_TRUNK_ID (ver buildInboundEntries)
// porque esses valores são gravados LITERAIS no dialplan a partir da própria InboundRoute no
// momento do create/update - não dependem do TRUNKID resolvido em tempo de chamada.
function routedExten(companyAsteriskId: string, didNumber: string) {
    return `${didNumber}_${companyAsteriskId}`
}

type Entry = { context: string; exten: string; priority: number; app: string; appdata: string | null }

function buildInboundEntries(
    exten: string,
    app: string,
    appdata: string | null,
    trunkId: string,
    didNumber: string,
    maxIn: number | null | undefined,
): Entry[] {
    // didNumber vem de Did.number, validado por regex ^\d+$ (ver did.schema.ts) - seguro
    // interpolar direto no appdata, sem risco de injeção no dialplan
    const mixmonitorFilename =
        '/var/spool/asterisk/monitor/${CHANNEL(accountcode)}/${STRFTIME(${EPOCH},,%Y/%m/%d)}/' +
        recordingFilenameSuffix('${CALLERID(num)}', didNumber)

    const entries: Entry[] = []
    let priority = 1
    const push = (stepApp: string, stepAppdata: string | null) => {
        entries.push({ context: TRUNK_ROUTED_CONTEXT, exten, priority: priority++, app: stepApp, appdata: stepAppdata })
    }

    push('Set', `${ROUTING_TRUNK_VAR}=${trunkId}`)
    // Contexto nativo do canal do cliente é from-trunk-routed, não ramais - sem isso, uma
    // transferência atendida (DTMF *2) tentaria resolver o destino em from-trunk-routed e falharia com
    // "extensão não encontrada". [transfer] (extensions.conf, estático) chama o AGI transfer-route,
    // que resolve o dígito discado pra ramal OU fila da MESMA empresa via CHANNEL(accountcode)
    // (ver handleTransferRoute em agi-server.ts) - sem isso, transferir pra uma fila (ex: 600) caía
    // direto em ramais e tentava discar um ramal PJSIP inexistente.
    // Duplo underscore (herança indefinida): quem inicia a transferência DTMF é sempre a parte
    // CHAMADA (opção "t", nunca "T" - ver dialplan.repository.ts/queue.repository.ts), ou seja o
    // canal do ramal/agente, criado por Dial()/Queue() A PARTIR deste canal do trunk. Sem "__", só
    // este canal (o do cliente) teria a variável, e o Asterisk resolve TRANSFER_CONTEXT do canal
    // que PRESSIONOU o DTMF (o ramal) - sem herança, cai no fallback (contexto próprio do ramal,
    // "ramais") e trata o destino como ramal em vez de rodar o AGI transfer-route.
    push('Set', '__TRANSFER_CONTEXT=transfer')
    // Enriquecimento de CDR - persiste no canal do ligante e sobrevive a qualquer Goto
    // intermediário (timecondition/holiday/ivr/queue/extension) até o Dial final
    push('Set', 'CDR(direction)=inbound')
    push('Set', `CDR(trunk_id)=${trunkId}`)
    push('Set', `CDR(dialed_number)=${didNumber}`)

    let gotoIfIndex = -1
    if (maxIn != null) {
        push('Set', `GROUP()=in-${trunkId}`)
        gotoIfIndex = entries.length
        push('GotoIf', '') // appdata corrigido depois, quando sabemos a priority do Congestion
    }

    push('Answer', null)
    // RTP ainda não estabilizou logo após o Answer - qualquer app que já toque áudio na sequência
    // (Playback do IVR/Announcement, MOH da Queue) corta o começo do primeiro frame sem essa
    // pausa. 3s cobre o handshake do canal de mídia com a operadora antes de qualquer coisa tocar.
    push('Wait', '3')
    // Grava desde a entrada - mesmo padrão de dialplan.repository.ts (ramais/internal), só que
    // sem alias de ramal: usa o número do DID discado como identificador no nome do arquivo
    push('Set', `MIXMONITOR_FILENAME=${mixmonitorFilename}`)
    push('MixMonitor', '${MIXMONITOR_FILENAME},b')
    push('Set', 'CDR(recording_file)=${MIXMONITOR_FILENAME}')
    push(app, appdata)

    if (maxIn != null) {
        const congestionPriority = priority
        entries[gotoIfIndex]!.appdata = `$[\${GROUP_COUNT(in-${trunkId})} > ${maxIn}]?${congestionPriority}`
        push('Congestion', null)
    }

    return entries
}

export const InboundRouteRepository = {
    async create(tx: Tx, trunkId: string, companyAsteriskId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(companyAsteriskId, didNumber)
        const { app, appdata } = await resolveDestination(dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, didNumber, maxIn) })
    },

    async update(tx: Tx, trunkId: string, companyAsteriskId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(companyAsteriskId, didNumber)
        await tx.extensions.deleteMany({ where: { context: TRUNK_ROUTED_CONTEXT, exten } })
        const { app, appdata } = await resolveDestination(dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, didNumber, maxIn) })
    },

    async delete(tx: Tx, companyAsteriskId: string, didNumber: string) {
        await tx.extensions.deleteMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: routedExten(companyAsteriskId, didNumber) },
        })
    },

    async deleteMany(tx: Tx, companyAsteriskId: string, didNumbers: string[]) {
        if (didNumbers.length === 0) return
        await tx.extensions.deleteMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: { in: didNumbers.map((n) => routedExten(companyAsteriskId, n)) } },
        })
    },

    // Regera o dialplan de TODAS as inbound routes da empresa a partir do template atual - cobre
    // rotas criadas antes de uma mudança de template (ex: novos campos de CDR, gravação, ou a própria
    // migração da chave de roteamento pra <did>_<companyAsteriskId>) que nunca foram salvas de novo
    // via update() desde então. Usado por resyncDialplan (companies.service.ts) e pelo backfill de boot.
    async regenerateAll(companyId: string) {
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { asteriskId: true } })
        if (!company) return 0

        const routes = await prisma.inboundRoute.findMany({
            where: { companyId },
            select: { id: true, trunkId: true, did: { select: { number: true } }, trunk: { select: { maxInChannels: true } } },
        })
        if (routes.length === 0) return 0

        const edges = await FlowEdgeRepository.getBySource(companyId, 'inboundroute')

        await prisma.$transaction(async (tx) => {
            for (const route of routes) {
                const dest = edges.get(route.id)?.default ?? null
                await this.update(tx, route.trunkId, company.asteriskId, route.did.number, dest, route.trunk.maxInChannels)
            }
        })
        return routes.length
    },

    // Remove linhas Realtime de from-trunk-routed que sobraram de uma InboundRoute apagada por fora
    // do fluxo normal (delete()/deleteMany() já limpam na hora - isso cobre drift: tamper manual no
    // banco, bug, restore parcial). Escopado por sufixo _<companyAsteriskId> no exten (asteriskId é
    // único globalmente, sem risco de tocar exten de outra empresa).
    async pruneOrphans(companyId: string) {
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { asteriskId: true } })
        if (!company) return 0

        const routes = await prisma.inboundRoute.findMany({
            where: { companyId },
            select: { did: { select: { number: true } } },
        })
        const validExtens = new Set(routes.map((r) => routedExten(company.asteriskId, r.did.number)))

        const existing = await prisma.extensions.findMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: { endsWith: `_${company.asteriskId}` } },
            select: { exten: true },
            distinct: ['exten'],
        })
        const orphanExtens = existing.map((e) => e.exten).filter((exten) => !validExtens.has(exten))
        if (orphanExtens.length === 0) return 0

        await prisma.extensions.deleteMany({ where: { context: TRUNK_ROUTED_CONTEXT, exten: { in: orphanExtens } } })
        return orphanExtens.length
    },
}
