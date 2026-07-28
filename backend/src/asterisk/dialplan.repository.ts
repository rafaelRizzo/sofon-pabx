import { prisma } from '../lib/prisma'
import { recordingFilenameSuffix } from './dialplan-names'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Bate com aliasSchema (/^\d{2,6}$/) — um padrão de dialplan por tamanho de alias
const RAMAL_ALIAS_LENGTHS = [2, 3, 4, 5, 6]

export const DialplanRepository = {
    // Padrão genérico compartilhado entre TODAS as empresas no mesmo contexto (idempotente, mesmo esquema de
    // ensureFallback) — em vez de 1 linha de dialplan por ramal (que colidia entre empresas com o mesmo alias,
    // já que o context é global). Usa CHANNEL(accountcode) — já setado em todo ps_endpoints/sip_peers como o
    // asteriskId da empresa de quem está discando — pra montar o alvo real (<alias>_<asteriskId>) e tenta as
    // duas tecnologias em paralelo no Dial: só a que existir de fato toca, a outra falha rápido (device not found).
    //
    // Apaga+recria (nunca skipDuplicates): essa pattern é criada só na 1ª vez que um extension precisa
    // provisionar o device Asterisk (ver provisionMissingAsteriskRecord em extensions.service.ts) — se
    // usasse skipDuplicates, uma mudança nesse template (nova prioridade CDR, novo formato de arquivo de
    // gravação, etc) nunca chegaria nas instalações já rodando, deixando prioridades órfãs da versão
    // antiga misturadas com as novas no mesmo (context, exten). Delete+recreate garante que o dialplan
    // em produção sempre reflita exatamente o código atual sempre que essa função rodar de novo
    // (ver resyncDialplan em companies.service.ts).
    async ensureGenericRoutingPattern(tx: Tx, context: string) {
        const extens = RAMAL_ALIAS_LENGTHS.map((len) => `_${'X'.repeat(len)}`)
        const data = extens.flatMap((exten) => [
            {
                context, exten, priority: 1, app: 'Set',
                appdata: 'MIXMONITOR_FILENAME=/var/spool/asterisk/monitor/${CHANNEL(accountcode)}/${STRFTIME(${EPOCH},,%Y/%m/%d)}/'
                    + recordingFilenameSuffix('${CUT(CALLERID(num),_,1)}', '${EXTEN}'),
            },
            { context, exten, priority: 2, app: 'MixMonitor', appdata: '${MIXMONITOR_FILENAME},b' },
            // Enriquecimento de CDR — chamada ramal-para-ramal (genuinamente interna, essa
            // pattern só casa dial direto entre ramais; ver route-destination-resolver.ts pro
            // porquê de rotas de entrada não caírem aqui)
            { context, exten, priority: 3, app: 'Set', appdata: 'CDR(direction)=internal' },
            { context, exten, priority: 4, app: 'Set', appdata: 'CDR(origin_extension)=${CALLERID(num)}' },
            { context, exten, priority: 5, app: 'Set', appdata: 'CDR(dialed_number)=${EXTEN}' },
            { context, exten, priority: 6, app: 'Set', appdata: 'CDR(recording_file)=${MIXMONITOR_FILENAME}' },
            { context, exten, priority: 7, app: 'Dial', appdata: 'PJSIP/${EXTEN}_${CHANNEL(accountcode)}&SIP/${EXTEN}_${CHANNEL(accountcode)},20' },
            { context, exten, priority: 8, app: 'Set', appdata: 'CDR(hangup_cause)=${HANGUPCAUSE}' },
            // CHANNEL(hangupsource) só vem preenchido depois que o Dial retorna — identifica o canal exato
            // que mandou o BYE/CANCEL; DIALSTATUS cobre os casos sem hangupsource (ex: BUSY, NOANSWER)
            { context, exten, priority: 9, app: 'NoOp', appdata: 'Chamada ${EXTEN} encerrada — status=${DIALSTATUS}, por=${CHANNEL(hangupsource)}' },
            { context, exten, priority: 10, app: 'HangUp', appdata: null },
        ])
        await tx.extensions.deleteMany({ where: { context, exten: { in: extens } } })
        await tx.extensions.createMany({ data })
    },

    async ensureFallback(tx: Tx, context: string) {
        await tx.extensions.deleteMany({ where: { context, exten: '_X.' } })
        await tx.extensions.createMany({
            data: [
                { context, exten: '_X.', priority: 1, app: 'NoOp', appdata: 'Destino nao encontrado: ${EXTEN}' },
                { context, exten: '_X.', priority: 2, app: 'Congestion', appdata: null },
            ],
        })
    },
}
