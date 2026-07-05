import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten,
} from './dialplan-names'

export { IVR_CONTEXT, ivrExten }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// "context,exten,priority" para destinos fora do exten atual, ou null para hangup —
// mesmo contrato de resolveRoute() em timecondition.repository.ts
async function resolveTarget(tx: Tx, dest: RouteDestination): Promise<string | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            const ext = await tx.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await tx.queue.findUnique({
                where: { id: dest.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${dest.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(dest.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(dest.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(dest.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(dest.id)},1`
    }
}

type MenuConfig = {
    name: string
    soundPath: string
    maxDigits: number
    digitTimeout: number
    invalidRetries: number
    timeoutRetries: number
}

type DigitOption = { digit: string; destination: RouteDestination }

type Row = { context: string; exten: string; priority: number; app: string; appdata: string | null }

// Máquina de estados construída só com prioridades numéricas dentro do MESMO exten (Goto/GotoIf
// aceitam um número puro como alvo = "essa prioridade, mesmo contexto/exten") — sem depender de
// labels do extensions.conf, que não existem no dialplan realtime (mesma limitação de tc-<id>).
//
// Read() lê até maxDigits, parando antes se o chamador pausar entre dígitos: 0 dígitos == timeout
// (READSTATUS=TIMEOUT), 1+ dígitos == segue pro match (LEN==1 checa as opções; LEN>1 vai pro
// longDestination — ex: CPF). "attempts" do Read fica fixo em 1: quem controla o retry (inválido
// e timeout, com contadores/limites independentes) é a própria state machine, via __IVR_INV/__IVR_TMO.
function buildDialplan(
    id: string,
    cfg: MenuConfig,
    options: { digit: string; target: string | null }[],
    invalidTarget: string | null,
    timeoutTarget: string | null,
    longTarget: string | null,
) {
    const context = IVR_CONTEXT
    const exten = ivrExten(id)
    const K = options.length

    const READ = 4
    const TIMEOUT_CHECK = 5
    const LEN_CHECK = 6
    const DIGITS_START = 7
    const INVALID_INCR = DIGITS_START + K
    const INVALID_CHECK = INVALID_INCR + 1
    const INVALID_RETRY = INVALID_INCR + 2
    const INVALID_DEST = INVALID_INCR + 3
    const MULTI = INVALID_INCR + 4
    const TIMEOUT_INCR = INVALID_INCR + 5
    const TIMEOUT_CHECK2 = INVALID_INCR + 6
    const TIMEOUT_RETRY = INVALID_INCR + 7
    const TIMEOUT_DEST = INVALID_INCR + 8
    const HANGUP = INVALID_INCR + 9

    const rows: Row[] = []
    const push = (priority: number, app: string, appdata: string | null) => rows.push({ context, exten, priority, app, appdata })

    push(1, 'NoOp', `IVR: ${cfg.name}`)
    push(2, 'Set', '__IVR_INV=0')
    push(3, 'Set', '__IVR_TMO=0')
    push(READ, 'Read', `IVR_DIGITS,${cfg.soundPath},${cfg.maxDigits},,1,${cfg.digitTimeout}`)
    push(TIMEOUT_CHECK, 'GotoIf', `$["\${READSTATUS}"="TIMEOUT"]?${TIMEOUT_INCR}`)
    push(LEN_CHECK, 'GotoIf', `$[\${LEN(\${IVR_DIGITS})} > 1]?${MULTI}`)

    options.forEach((opt, i) => {
        push(DIGITS_START + i, 'GotoIf', `$["\${IVR_DIGITS}"="${opt.digit}"]?${opt.target ?? HANGUP}`)
    })

    push(INVALID_INCR, 'Set', '__IVR_INV=$[${__IVR_INV}+1]')
    push(INVALID_CHECK, 'GotoIf', `$[\${__IVR_INV} > ${cfg.invalidRetries}]?${INVALID_DEST}`)
    push(INVALID_RETRY, 'Goto', `${READ}`)
    push(INVALID_DEST, invalidTarget ? 'Goto' : 'Hangup', invalidTarget)

    push(MULTI, 'Goto', longTarget ?? `${INVALID_INCR}`)

    push(TIMEOUT_INCR, 'Set', '__IVR_TMO=$[${__IVR_TMO}+1]')
    push(TIMEOUT_CHECK2, 'GotoIf', `$[\${__IVR_TMO} > ${cfg.timeoutRetries}]?${TIMEOUT_DEST}`)
    push(TIMEOUT_RETRY, 'Goto', `${READ}`)
    push(TIMEOUT_DEST, timeoutTarget ? 'Goto' : 'Hangup', timeoutTarget)

    push(HANGUP, 'Hangup', null)

    return rows
}

export const IvrRepository = {
    // soundPath: caminho absoluto SEM extensão (Read resolve o formato sozinho, igual Playback)
    async syncEntry(
        tx: Tx,
        id: string,
        cfg: MenuConfig,
        options: DigitOption[],
        invalidDestination: RouteDestination,
        timeoutDestination: RouteDestination,
        longDestination: RouteDestination,
    ) {
        const exten = ivrExten(id)
        await tx.extensions.deleteMany({ where: { context: IVR_CONTEXT, exten } })

        const [resolvedOptions, invalidTarget, timeoutTarget, longTarget] = await Promise.all([
            Promise.all(options.map(async (o) => ({ digit: o.digit, target: await resolveTarget(tx, o.destination) }))),
            resolveTarget(tx, invalidDestination),
            resolveTarget(tx, timeoutDestination),
            resolveTarget(tx, longDestination),
        ])

        const rows = buildDialplan(id, cfg, resolvedOptions, invalidTarget, timeoutTarget, longTarget)
        await tx.extensions.createMany({ data: rows })
    },

    async removeEntry(tx: Tx, id: string) {
        await tx.extensions.deleteMany({ where: { context: IVR_CONTEXT, exten: ivrExten(id) } })
    },

    async removeManyByIds(tx: Tx, ids: string[]) {
        if (ids.length === 0) return
        await tx.extensions.deleteMany({ where: { context: IVR_CONTEXT, exten: { in: ids.map(ivrExten) } } })
    },
}
