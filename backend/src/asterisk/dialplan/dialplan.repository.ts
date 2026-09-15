import { prisma } from '../../lib/prisma'
import { validateEnv } from '../../config/env'
import { recordingFilenameSuffix } from './dialplan-names'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const env = validateEnv()

// Bate com aliasSchema (/^\d{2,6}$/) - um padrão de dialplan por tamanho de alias
// Exportado pra outbound-routes.service.ts bloquear esses patterns + '_X.' em OutboundDialPattern -
// são reservados no contexto global 'ramais' (ver ensureGenericRoutingPattern/ensureFallback abaixo)
export const RAMAL_ALIAS_LENGTHS = [2, 3, 4, 5, 6]

export const DialplanRepository = {
    // Padrão genérico compartilhado entre TODAS as empresas no mesmo contexto (idempotente, mesmo esquema de
    // ensureFallback) - em vez de 1 linha de dialplan por ramal (que colidia entre empresas com o mesmo alias,
    // já que o context é global). Usa CHANNEL(accountcode) - já setado em todo ps_endpoints/sip_peers como o
    // asteriskId da empresa de quem está discando - pra montar o alvo real (<alias>_<asteriskId>).
    //
    // Apaga+recria (nunca skipDuplicates): essa pattern é criada só na 1ª vez que um extension precisa
    // provisionar o device Asterisk (ver provisionMissingAsteriskRecord em extensions.service.ts) - se
    // usasse skipDuplicates, uma mudança nesse template (nova prioridade CDR, novo formato de arquivo de
    // gravação, etc) nunca chegaria nas instalações já rodando, deixando prioridades órfãs da versão
    // antiga misturadas com as novas no mesmo (context, exten). Delete+recreate garante que o dialplan
    // em produção sempre reflita exatamente o código atual sempre que essa função rodar de novo
    // (ver resyncDialplan em companies.service.ts).
    async ensureGenericRoutingPattern(tx: Tx, context: string) {
        const extens = RAMAL_ALIAS_LENGTHS.map((len) => `_${'X'.repeat(len)}`)
        // SIP_LEGACY_ENABLED=false (instalações sem chan_sip, ver install-asterisk.sh): dial só
        // em PJSIP. Um Dial(PJSIP/...&SIP/...) tenta as duas tecnologias em paralelo mesmo sem chan_sip
        // carregado - o branch SIP falha imediatamente ("no channel type registered"), e o Asterisk
        // gera um CDR próprio pra CADA branch tentado (2 registros idênticos por ligação, um por tech -
        // ver duplicação em produção quando o ramal chamado rejeita/está ocupado). SIP_LEGACY_ENABLED=true
        // (instalações com sip_peers legado) mantém o dial duplo de propósito - só a tecnologia que
        // existir de fato toca, a outra falha rápido (device not found), sem esse efeito colateral porque
        // nesse caso o driver chan_sip está realmente carregado.
        const dialTarget = env.SIP_LEGACY_ENABLED
            ? 'PJSIP/${EXTEN}_${CHANNEL(accountcode)}&SIP/${EXTEN}_${CHANNEL(accountcode)}'
            : 'PJSIP/${EXTEN}_${CHANNEL(accountcode)}'
        const data = extens.flatMap((exten) => [
            {
                context, exten, priority: 1, app: 'Set',
                appdata: 'MIXMONITOR_FILENAME=/var/spool/asterisk/monitor/${CHANNEL(accountcode)}/${STRFTIME(${EPOCH},,%Y/%m/%d)}/'
                    + recordingFilenameSuffix('${CUT(CALLERID(num),_,1)}', '${EXTEN}'),
            },
            { context, exten, priority: 2, app: 'MixMonitor', appdata: '${MIXMONITOR_FILENAME},b' },
            // Enriquecimento de CDR - essa pattern também é a reentrada de transferências DTMF
            // vindas do contexto estático [transfer] (extensions.conf), que seta TRANSFERRED=1
            // antes do Goto - sem essa checagem, uma ligação inbound transferida pra um ramal
            // sobrescreveria CDR(direction)=inbound com "internal", perdendo a origem externa
            { context, exten, priority: 3, app: 'Set', appdata: 'CDR(direction)=${IF($["${TRANSFERRED}"="1"]?transfer:internal)}' },
            { context, exten, priority: 4, app: 'Set', appdata: 'CDR(origin_extension)=${CALLERID(num)}' },
            { context, exten, priority: 5, app: 'Set', appdata: 'CDR(dialed_number)=${EXTEN}' },
            { context, exten, priority: 6, app: 'Set', appdata: 'CDR(recording_file)=${MIXMONITOR_FILENAME}' },
            // opção "t" (não "T"): só a parte CHAMADA pode iniciar transferência DTMF atendida (*2,
            // ver features.conf) - esse mesmo padrão também é usado por rotas de entrada
            // direto pra ramal (route-destination-resolver.ts, type "extension"), então "T" daria
            // esse poder pro CLIENTE externo transferir a própria ligação, o que nunca é o desejado
            { context, exten, priority: 7, app: 'Dial', appdata: `${dialTarget},20,t` },
            // disposition nativo do CDR vira ANSWERED assim que o canal é atendido (mais abaixo, no
            // fallback de aviso) - independente do DIALSTATUS real do Dial. Captura o token bruto aqui,
            // antes de qualquer Answer(), pra cdr.service.ts poder reportar o resultado de verdade
            // (real_disposition) em vez do disposition nativo inflado
            { context, exten, priority: 8, app: 'Set', appdata: 'CDR(real_disposition)=${DIALSTATUS}' },
            // CHANUNAVAIL = Asterisk não achou o endpoint PJSIP <EXTEN>_<accountcode>, ou seja "não existe
            // esse ramal" (busca de ramal = tentativa nativa do Dial, sem query própria) - só nesse caso
            // faz sentido tentar fila/rota de saída (ver handleRamalFallback em agi-server.ts). Qualquer
            // outro DIALSTATUS (BUSY/NOANSWER/CANCEL/ANSWER) significa que o ramal existe e a chamada
            // seguiu seu curso normal - pula direto pro encerramento, sem tentar fallback nenhum.
            { context, exten, priority: 9, app: 'GotoIf', appdata: '$["${DIALSTATUS}"="CHANUNAVAIL"]?10:11' },
            { context, exten, priority: 10, app: 'AGI', appdata: 'agi://127.0.0.1:4573/ramal-fallback' },
            // DIALSTATUS=ANSWER = a chamada foi completada normalmente (uma das partes atendeu e depois
            // desligou) - pula direto pro encerramento sem tocar nada. Qualquer outro status (CHANUNAVAIL
            // sem fila/rota encontrada pelo AGI acima, BUSY, NOANSWER, CONGESTION, CANCEL) significa que o
            // chamador nunca ouviu nada além de silêncio - toca aviso de ramal indisponível antes de
            // desligar em vez de simplesmente cair a ligação sem explicação
            { context, exten, priority: 11, app: 'GotoIf', appdata: '$["${DIALSTATUS}"="ANSWER"]?14:12' },
            // Answer() idempotente (mesmo padrão de ensureFallback): em Dial ramal→ramal o canal de quem
            // discou pode nunca ter sido atendido - sem isso o Playback toca em canal ainda não em progress
            // e o áudio não chega no chamador
            { context, exten, priority: 12, app: 'Answer', appdata: null },
            { context, exten, priority: 13, app: 'Playback', appdata: 'ss-noservice' },
            { context, exten, priority: 14, app: 'Set', appdata: 'CDR(hangup_cause)=${HANGUPCAUSE}' },
            // CHANNEL(hangupsource) só vem preenchido depois que o Dial retorna - identifica o canal exato
            // que mandou o BYE/CANCEL; DIALSTATUS cobre os casos sem hangupsource (ex: BUSY, NOANSWER)
            { context, exten, priority: 15, app: 'NoOp', appdata: 'Chamada ${EXTEN} encerrada - status=${DIALSTATUS}, por=${CHANNEL(hangupsource)}' },
            { context, exten, priority: 16, app: 'HangUp', appdata: null },
        ])
        await tx.extensions.deleteMany({ where: { context, exten: { in: extens } } })
        await tx.extensions.createMany({ data })
    },

    async ensureFallback(tx: Tx, context: string) {
        await tx.extensions.deleteMany({ where: { context, exten: '_X.' } })
        await tx.extensions.createMany({
            data: [
                { context, exten: '_X.', priority: 1, app: 'NoOp', appdata: 'Destino nao encontrado: ${EXTEN}' },
                // Esse fallback é atingido direto pelo canal de quem discou (nunca passou por um Dial
                // que atendesse a ponta chamadora) - sem Answer() explícito aqui o Playback toca em canal
                // ainda não atendido e o áudio não chega no chamador (ver inboundroute.repository.ts:73)
                { context, exten: '_X.', priority: 2, app: 'Answer', appdata: null },
                // Som padrão do Asterisk (core-sounds) - anuncia o erro antes de encerrar a chamada
                { context, exten: '_X.', priority: 3, app: 'Playback', appdata: 'pbx-invalid' },
                { context, exten: '_X.', priority: 4, app: 'HangUp', appdata: null },
            ],
        })
    },

    // Self-heal de boot (ver ensure-static-config.ts, chamado em server.ts) - sem isso, uma mudança
    // no template de ensureGenericRoutingPattern/ensureFallback (ex: trocar Congestion por HangUp)
    // só se propagava pras instalações já rodando quando um admin clicasse manualmente em "sync" numa
    // empresa (resyncDialplan). Contexts vêm de TODAS as empresas (não filtra por companyId) porque o
    // padrão é global e compartilhado - qualquer contexto usado por qualquer ramal precisa ser coberto.
    async ensureAllRealtimeFallbacks(): Promise<number> {
        const contexts = await prisma.extension.findMany({
            select: { context: true },
            distinct: ['context'],
        })
        await prisma.$transaction(async (tx) => {
            for (const { context } of contexts) {
                await DialplanRepository.ensureGenericRoutingPattern(tx, context)
                await DialplanRepository.ensureFallback(tx, context)
            }
        })
        return contexts.length
    },
}
