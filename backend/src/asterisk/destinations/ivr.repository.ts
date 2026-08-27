import { prisma } from '../../lib/prisma'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { audioSoundPath } from './audio.repository'
import { IVR_CONTEXT, ivrExten } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'

export { IVR_CONTEXT, ivrExten }

// "context,exten,priority" para destinos fora do exten atual, ou null para hangup
async function resolveTarget(dest: RouteDestination): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

type MenuConfig = {
    name: string
    soundPath: string
    maxDigits: number
    digitTimeout: number
    invalidRetries: number
    timeoutRetries: number
    // type="collect" (ver ivr.schema.ts): nome da variável de canal que recebe os dígitos
    // coletados antes do Goto pro longDestination, pra outros módulos (Request Template,
    // Validar Variável) lerem por nome. null quando type="menu" (não expõe nada)
    variableName: string | null
}

// Máquina de estados construída só com prioridades numéricas dentro do MESMO exten (Goto/GotoIf
// aceitam um número puro como alvo = "essa prioridade, mesmo contexto/exten") - sem depender de
// labels do extensions.conf, que não existem no dialplan estático gerado por entidade (mesma
// limitação de tc-<id>).
//
// Read() lê até maxDigits, parando antes se o chamador pausar entre dígitos: 0 dígitos == timeout
// (READSTATUS=TIMEOUT), 1+ dígitos == segue pro match (LEN==1 checa as opções; LEN>1 vai pro
// longDestination, ex: CPF/CNPJ em type="collect", que não tem opções). Antes desse Goto, se
// variableName estiver configurado, os dígitos são copiados pra essa variável (Set): é o único
// jeito de outros módulos (Request Template, Validar Variável) lerem o valor coletado depois do
// Goto, já que IVR_DIGITS é interna e compartilhada por todo Read() deste contexto. "attempts" do
// Read fica fixo em 1: quem controla o retry (inválido e timeout, com contadores/limites
// independentes) é a própria state machine, via __IVR_INV/__IVR_TMO.
export function buildDialplan(
    id: string,
    cfg: MenuConfig,
    options: { digit: string; target: string | null }[],
    invalidTarget: string | null,
    timeoutTarget: string | null,
    longTarget: string | null,
    location: { context: string; exten: string } = { context: IVR_CONTEXT, exten: ivrExten(id) },
): DialplanRow[] {
    const { context, exten } = location
    const K = options.length

    const READ = 4
    const TIMEOUT_CHECK = 5
    const LEN_CHECK = 6
    const DIGITS_START = 7
    const INVALID_INCR = DIGITS_START + K
    const INVALID_CHECK = INVALID_INCR + 1
    const INVALID_RETRY = INVALID_INCR + 2
    const INVALID_DEST = INVALID_INCR + 3
    // MULTI_SET sempre existe (Set quando variableName configurado, NoOp caso contrário): mantém
    // a numeração do resto da state machine fixa independente de type="menu"/"collect"
    const MULTI_SET = INVALID_INCR + 4
    const MULTI_GOTO = INVALID_INCR + 5
    const TIMEOUT_INCR = INVALID_INCR + 6
    const TIMEOUT_CHECK2 = INVALID_INCR + 7
    const TIMEOUT_RETRY = INVALID_INCR + 8
    const TIMEOUT_DEST = INVALID_INCR + 9
    const HANGUP = INVALID_INCR + 10

    const rows: DialplanRow[] = []
    const push = (priority: number, app: string, appdata: string | null) => rows.push({ context, exten, priority, app, appdata })

    push(1, 'NoOp', `IVR: ${cfg.name}`)
    push(2, 'Set', '__IVR_INV=0')
    push(3, 'Set', '__IVR_TMO=0')
    push(READ, 'Read', `IVR_DIGITS,${cfg.soundPath},${cfg.maxDigits},,1,${cfg.digitTimeout}`)
    push(TIMEOUT_CHECK, 'GotoIf', `$["\${READSTATUS}"="TIMEOUT"]?${TIMEOUT_INCR}`)
    push(LEN_CHECK, 'GotoIf', `$[\${LEN(\${IVR_DIGITS})} > 1]?${MULTI_SET}`)

    options.forEach((opt, i) => {
        push(DIGITS_START + i, 'GotoIf', `$["\${IVR_DIGITS}"="${opt.digit}"]?${opt.target ?? HANGUP}`)
    })

    push(INVALID_INCR, 'Set', '__IVR_INV=$[${__IVR_INV}+1]')
    push(INVALID_CHECK, 'GotoIf', `$[\${__IVR_INV} > ${cfg.invalidRetries}]?${INVALID_DEST}`)
    push(INVALID_RETRY, 'Goto', `${READ}`)
    push(INVALID_DEST, invalidTarget ? 'Goto' : 'Hangup', invalidTarget)

    push(MULTI_SET, cfg.variableName ? 'Set' : 'NoOp', cfg.variableName ? `${cfg.variableName}=\${IVR_DIGITS}` : null)
    push(MULTI_GOTO, 'Goto', longTarget ?? `${INVALID_INCR}`)

    push(TIMEOUT_INCR, 'Set', '__IVR_TMO=$[${__IVR_TMO}+1]')
    push(TIMEOUT_CHECK2, 'GotoIf', `$[\${__IVR_TMO} > ${cfg.timeoutRetries}]?${TIMEOUT_DEST}`)
    push(TIMEOUT_RETRY, 'Goto', `${READ}`)
    push(TIMEOUT_DEST, timeoutTarget ? 'Goto' : 'Hangup', timeoutTarget)

    push(HANGUP, 'Hangup', null)

    return rows
}

export const IvrRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco - chamado depois de qualquer create/update/delete de IvrMenu. Menu sem áudio
    // vinculado ainda entra no arquivo como Hangup (evita "invalid extension" se usado como destino
    // de rota antes de ter áudio configurado).
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${IVR_CONTEXT}:${asteriskId}`, async () => {
            const [menus, menuEdges, optionEdges] = await Promise.all([
                prisma.ivrMenu.findMany({
                    where: { companyId },
                    include: { options: { orderBy: { digit: 'asc' } } },
                }),
                FlowEdgeRepository.getBySource(companyId, 'ivrmenu'),
                FlowEdgeRepository.getBySource(companyId, 'ivroption'),
            ])
            const entries: DialplanRow[] = []
            for (const m of menus) {
                if (!m.audioId) {
                    entries.push({ context: IVR_CONTEXT, exten: ivrExten(m.id), priority: 1, app: 'Hangup', appdata: null })
                    continue
                }
                const [resolvedOptions, invalidTarget, timeoutTarget, longTarget] = await Promise.all([
                    Promise.all(m.options.map(async (o) => ({ digit: o.digit, target: await resolveTarget(optionEdges.get(o.id)?.default ?? null) }))),
                    resolveTarget(menuEdges.get(m.id)?.invalid ?? null),
                    resolveTarget(menuEdges.get(m.id)?.timeout ?? null),
                    resolveTarget(menuEdges.get(m.id)?.long ?? null),
                ])
                entries.push(...buildDialplan(
                    m.id,
                    {
                        name: m.name,
                        soundPath: audioSoundPath(asteriskId, m.audioId),
                        maxDigits: m.maxDigits,
                        digitTimeout: m.digitTimeout,
                        invalidRetries: m.invalidRetries,
                        timeoutRetries: m.timeoutRetries,
                        variableName: m.variableName,
                    },
                    resolvedOptions, invalidTarget, timeoutTarget, longTarget,
                ))
            }
            await writeContextFile(IVR_CONTEXT, asteriskId, entries)
            // URAs usadas em FlowNode são compiladas por instância para que cada saída tenha sua
            // própria aresta. Regera essas instâncias quando a configuração/opções do menu muda.
            const { FlowNodeRepository } = await import('../flows/flow-node.repository')
            await FlowNodeRepository.regenerate(companyId)
            reloadDialplan()
        })
    },
}
