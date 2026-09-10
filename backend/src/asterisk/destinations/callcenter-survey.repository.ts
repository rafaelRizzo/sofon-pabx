import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { audioSoundPath } from './audio.repository'
import { SURVEY_CONTEXT, surveyExten } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'

const env = validateEnv()

type SurveyCategory = 'atendimento' | 'servico'

const buildSurveyResultAgiUrl = (queueId: string, category: SurveyCategory, score: number) =>
    `agi://${env.AGI_HOST}:${env.AGI_PORT}/survey-result,${queueId},${category},${score}`

const DIGIT_TIMEOUT_SECONDS = 5
const INVALID_RETRIES = 2

// Um bloco = uma pergunta (Read de 1 dígito 1-5 + retry de inválido/timeout + AGI que persiste a
// nota) - mesma técnica de máquina de estados por prioridade numérica de ivr.repository.ts. Cada
// bloco ocupa sempre 22 prioridades (start..start+21) independente da pergunta, o que permite
// encadear blocos em sequência dentro do mesmo exten só somando o tamanho fixo. onFailGoto é usado
// tanto pro timeout quanto pro esgotar tentativas de dígito inválido (mesmo destino - falha em
// qualquer pergunta pula direto pro final, nunca tenta a próxima pergunta sem resposta válida).
function buildQuestionBlock(
    context: string,
    exten: string,
    queueId: string,
    start: number,
    varSuffix: '1' | '2',
    category: SurveyCategory,
    soundPath: string,
    onFailGoto: number,
    onSuccessGoto: number,
): DialplanRow[] {
    const NOOP = start
    const INIT = start + 1
    const READ = start + 2
    const TIMEOUT_CHECK = start + 3
    const DIGITS_START = start + 4
    const INVALID_INCR = DIGITS_START + 5
    const INVALID_CHECK = INVALID_INCR + 1
    const INVALID_RETRY = INVALID_INCR + 2
    const SCORE_START = INVALID_INCR + 3

    const INV_VAR = `__SURV_INV${varSuffix}`
    const DIGIT_VAR = `SURV_DIGIT${varSuffix}`

    const rows: DialplanRow[] = []
    const push = (priority: number, app: string, appdata: string | null) => rows.push({ context, exten, priority, app, appdata })

    push(NOOP, 'NoOp', `Pesquisa de satisfacao (${category}): fila ${queueId}`)
    push(INIT, 'Set', `${INV_VAR}=0`)
    push(READ, 'Read', `${DIGIT_VAR},${soundPath},1,,1,${DIGIT_TIMEOUT_SECONDS}`)
    push(TIMEOUT_CHECK, 'GotoIf', `$["\${READSTATUS}"="TIMEOUT"]?${onFailGoto}`)

    for (let score = 1; score <= 5; score++) {
        push(DIGITS_START + score - 1, 'GotoIf', `$["\${${DIGIT_VAR}}"="${score}"]?${SCORE_START + (score - 1) * 2}`)
    }

    push(INVALID_INCR, 'Set', `${INV_VAR}=$[\${${INV_VAR}}+1]`)
    push(INVALID_CHECK, 'GotoIf', `$[\${${INV_VAR}} > ${INVALID_RETRIES}]?${onFailGoto}`)
    push(INVALID_RETRY, 'Goto', `${READ}`)

    for (let score = 1; score <= 5; score++) {
        const p = SCORE_START + (score - 1) * 2
        push(p, 'AGI', buildSurveyResultAgiUrl(queueId, category, score))
        push(p + 1, 'Goto', `${onSuccessGoto}`)
    }

    return rows
}

const BLOCK_SIZE = 22

// 2 perguntas sequenciais no mesmo exten (survey-<queueId>): pergunta 1 é sobre o ATENDIMENTO (o
// agente), pergunta 2 sobre o SERVIÇO CONTRATADO (o plano/produto) - notas independentes
// (CallRating.category), só a de atendimento entra em AgentAffinity (ver affinity.service.ts).
// Regenerado sempre que Queue.surveyAudioId/surveyServiceAudioId/surveyThanksAudioId mudam (ver
// QueuesService) - fila sem os 2 áudios de pergunta setados não entra no arquivo (pesquisa
// desligada, all-or-nothing). thanksSoundPath é independente e opcional: só toca um Playback extra
// em FINAL_HANGUP antes do Hangup quando setado - não afeta se a pesquisa existe ou não.
function buildSurveyDialplan(
    queueId: string,
    atendimentoSoundPath: string,
    servicoSoundPath: string,
    thanksSoundPath: string | null,
): DialplanRow[] {
    const context = SURVEY_CONTEXT
    const exten = surveyExten(queueId)

    const BLOCK1_START = 1
    const BLOCK2_START = BLOCK1_START + BLOCK_SIZE
    const FINAL_HANGUP = BLOCK2_START + BLOCK_SIZE

    const block1 = buildQuestionBlock(
        context, exten, queueId, BLOCK1_START, '1', 'atendimento', atendimentoSoundPath,
        FINAL_HANGUP, BLOCK2_START,
    )
    const block2 = buildQuestionBlock(
        context, exten, queueId, BLOCK2_START, '2', 'servico', servicoSoundPath,
        FINAL_HANGUP, FINAL_HANGUP,
    )

    const final: DialplanRow[] = thanksSoundPath
        ? [
              { context, exten, priority: FINAL_HANGUP, app: 'Playback', appdata: thanksSoundPath },
              { context, exten, priority: FINAL_HANGUP + 1, app: 'Hangup', appdata: null },
          ]
        : [{ context, exten, priority: FINAL_HANGUP, app: 'Hangup', appdata: null }]

    return [...block1, ...block2, ...final]
}

export const CallcenterSurveyRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto - chamado sempre que
    // Queue.surveyAudioId/surveyServiceAudioId mudam (create/update). Fila sem os dois áudios
    // setados não gera exten nenhuma: se o AGI de pós-fila (handleQueueSurvey) tentar dar Goto pra
    // um exten inexistente aqui, o Asterisk simplesmente falha o Goto (segue pro
    // postQueueDestination normal) - fail-safe.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${SURVEY_CONTEXT}:${asteriskId}`, async () => {
            const queues = await prisma.queue.findMany({
                where: { companyId, surveyAudioId: { not: null }, surveyServiceAudioId: { not: null } },
                select: { id: true, surveyAudioId: true, surveyServiceAudioId: true, surveyThanksAudioId: true },
            })
            const entries: DialplanRow[] = queues.flatMap((q) =>
                buildSurveyDialplan(
                    q.id,
                    audioSoundPath(asteriskId, q.surveyAudioId!),
                    audioSoundPath(asteriskId, q.surveyServiceAudioId!),
                    q.surveyThanksAudioId ? audioSoundPath(asteriskId, q.surveyThanksAudioId) : null,
                )
            )
            await writeContextFile(SURVEY_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
