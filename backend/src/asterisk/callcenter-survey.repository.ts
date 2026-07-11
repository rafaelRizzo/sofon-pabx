import { prisma } from '../lib/prisma'
import { validateEnv } from '../config/env'
import { audioSoundPath } from './audio.repository'
import { SURVEY_CONTEXT, surveyExten } from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

const env = validateEnv()

const buildSurveyResultAgiUrl = (queueId: string, score: number) =>
    `agi://${env.AGI_HOST}:${env.AGI_PORT}/survey-result,${queueId},${score}`

const DIGIT_TIMEOUT_SECONDS = 5
const INVALID_RETRIES = 2

// Pesquisa de satisfação pós-atendimento: Read() de 1 dígito (1-5) + AGI que persiste a nota —
// mesma técnica de máquina de estados por prioridade numérica de ivr.repository.ts, só sem o branch
// de maxDigits > 1 (nota é sempre 1 dígito fixo). Regenerado sempre que Queue.surveyAudioId muda
// (ver QueuesService) — fila com surveyAudioId nulo não entra no arquivo (pesquisa desligada).
function buildSurveyDialplan(queueId: string, soundPath: string): DialplanRow[] {
    const context = SURVEY_CONTEXT
    const exten = surveyExten(queueId)

    const READ = 3
    const TIMEOUT_CHECK = 4
    const DIGITS_START = 5
    const INVALID_INCR = DIGITS_START + 5
    const INVALID_CHECK = INVALID_INCR + 1
    const INVALID_RETRY = INVALID_INCR + 2
    const SCORE_START = INVALID_INCR + 3
    const HANGUP = SCORE_START + 10

    const rows: DialplanRow[] = []
    const push = (priority: number, app: string, appdata: string | null) => rows.push({ context, exten, priority, app, appdata })

    push(1, 'NoOp', `Pesquisa de satisfacao: fila ${queueId}`)
    push(2, 'Set', '__SURV_INV=0')
    push(READ, 'Read', `SURV_DIGIT,${soundPath},1,,1,${DIGIT_TIMEOUT_SECONDS}`)
    push(TIMEOUT_CHECK, 'GotoIf', `$["\${READSTATUS}"="TIMEOUT"]?${HANGUP}`)

    for (let score = 1; score <= 5; score++) {
        push(DIGITS_START + score - 1, 'GotoIf', `$["\${SURV_DIGIT}"="${score}"]?${SCORE_START + (score - 1) * 2}`)
    }

    push(INVALID_INCR, 'Set', '__SURV_INV=$[${__SURV_INV}+1]')
    push(INVALID_CHECK, 'GotoIf', `$[\${__SURV_INV} > ${INVALID_RETRIES}]?${HANGUP}`)
    push(INVALID_RETRY, 'Goto', `${READ}`)

    for (let score = 1; score <= 5; score++) {
        const p = SCORE_START + (score - 1) * 2
        push(p, 'AGI', buildSurveyResultAgiUrl(queueId, score))
        push(p + 1, 'Goto', `${HANGUP}`)
    }

    push(HANGUP, 'Hangup', null)

    return rows
}

export const CallcenterSurveyRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto — chamado sempre que
    // Queue.surveyAudioId muda (create/update). Fila sem surveyAudioId não gera exten nenhuma:
    // se o AGI de pós-fila (handleQueueSurvey) tentar dar Goto pra um exten inexistente aqui, o
    // Asterisk simplesmente falha o Goto (segue pro postQueueDestination normal) — fail-safe.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${SURVEY_CONTEXT}:${asteriskId}`, async () => {
            const queues = await prisma.queue.findMany({
                where: { companyId, surveyAudioId: { not: null } },
                select: { id: true, surveyAudioId: true },
            })
            const entries: DialplanRow[] = queues.flatMap((q) =>
                buildSurveyDialplan(q.id, audioSoundPath(asteriskId, q.surveyAudioId!))
            )
            await writeContextFile(SURVEY_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
