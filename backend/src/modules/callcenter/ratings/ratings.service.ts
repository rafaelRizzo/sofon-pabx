import { prisma } from '../../../lib/prisma'
import { getCompanyById } from '../../companies/companies.service'
import { getExtensionDto } from '../../extensions/extensions.service'
import { AppError } from '../../../utils/errors/app.error'
import type { RatingQueryInput, RatingExportQueryInput, CreateRatingInput } from './schemas/call-rating.schema'

function buildWhere(query: RatingQueryInput | RatingExportQueryInput) {
    return {
        companyId: query.companyId,
        ...(query.extensionId && { extensionId: query.extensionId }),
        ...(query.number && { number: { contains: query.number } }),
        // 1 linha carrega as 2 notas da chamada - bate se qualquer uma das duas casar
        ...(query.score && { OR: [{ scoreAtendimento: query.score }, { scoreServico: query.score }] }),
        ...((query.startDate || query.endDate) && {
            createdAt: {
                ...(query.startDate && { gte: new Date(`${query.startDate}T00:00:00.000Z`) }),
                ...(query.endDate && { lte: new Date(`${query.endDate}T23:59:59.999Z`) }),
            },
        }),
    }
}

// Bulk-checa quais uniqueids têm gravação (cdr.recordingFile) - evita 1 query por linha na
// listagem/export. Isolamento pelo mesmo par usado no resto do CDR: accountcode = Company.asteriskId
async function findRecordedUniqueids(uniqueids: string[], asteriskId: string): Promise<Set<string>> {
    if (uniqueids.length === 0) return new Set()
    const rows = await prisma.cdr.findMany({
        where: { uniqueid: { in: uniqueids }, accountcode: asteriskId, recordingFile: { not: null } },
        select: { uniqueid: true },
    })
    return new Set(rows.map((r) => r.uniqueid).filter((u): u is string => !!u))
}

export const getRatingsByCompany = async (query: RatingQueryInput) => {
    const company = await getCompanyById(query.companyId)

    const where = buildWhere(query)

    const [rows, total] = await Promise.all([
        prisma.callRating.findMany({
            where,
            orderBy: [{ createdAt: query.order }, { id: query.order }],
            take: query.limit,
            skip: (query.page - 1) * query.limit,
        }),
        prisma.callRating.count({ where }),
    ])

    const recorded = await findRecordedUniqueids(
        [...new Set(rows.map((r) => r.uniqueid).filter((u): u is string => !!u))],
        company.asteriskId
    )
    const records = rows.map((r) => ({ ...r, hasRecording: !!r.uniqueid && recorded.has(r.uniqueid) }))

    return { records, total, limit: query.limit, page: query.page }
}

const EXPORT_BATCH_SIZE = 500

// Company já resolvida (e posse validada) pelo controller antes de abrir o stream - mesmo motivo
// documentado em cdr.service.ts/iterateCdrExportRecords: 404 precisa acontecer antes do primeiro
// byte da resposta, nunca no meio de um generator já consumido pelo Readable
export async function* iterateRatingExportRecords(company: { asteriskId: string }, query: RatingExportQueryInput) {
    const where = buildWhere(query)
    let skip = 0
    for (;;) {
        const rows = await prisma.callRating.findMany({
            where,
            orderBy: [{ createdAt: query.order }, { id: query.order }],
            take: EXPORT_BATCH_SIZE,
            skip,
        })
        if (rows.length === 0) break

        const extensionIds = [...new Set(rows.map((r) => r.extensionId))]
        const extensions = await prisma.extension.findMany({
            where: { id: { in: extensionIds } },
            select: { id: true, alias: true, name: true },
        })
        const extensionById = new Map(extensions.map((e) => [e.id, e]))

        const recorded = await findRecordedUniqueids(
            [...new Set(rows.map((r) => r.uniqueid).filter((u): u is string => !!u))],
            company.asteriskId
        )

        yield rows.map((r) => ({
            ...r,
            extension: extensionById.get(r.extensionId) ?? null,
            hasRecording: !!r.uniqueid && recorded.has(r.uniqueid),
        }))

        if (rows.length < EXPORT_BATCH_SIZE) break
        skip += EXPORT_BATCH_SIZE
    }
}

// A pesquisa faz 2 perguntas (atendimento/serviço) pro mesmo cliente na mesma chamada - sem upsert
// aqui, cada pergunta virava uma linha própria (2 linhas pra 1 ligação, sem sentido pro usuário).
// Com uniqueid (sempre presente no fluxo real via AGI/UNIQUEID), a 2ª pergunta atualiza a mesma
// linha da 1ª em vez de criar outra. Sem uniqueid (só possível chamando a rota manualmente sem o
// campo), cria linha própria mesmo - não dá pra saber que é a mesma chamada.
export const createRating = async (data: CreateRatingInput) => {
    await getCompanyById(data.companyId)
    await getExtensionDto(data.extensionId)

    const scoreField = data.category === 'servico' ? { scoreServico: data.score } : { scoreAtendimento: data.score }

    if (!data.uniqueid) {
        return prisma.callRating.create({
            data: { companyId: data.companyId, extensionId: data.extensionId, number: data.number, uniqueid: data.uniqueid, ...scoreField },
        })
    }

    return prisma.callRating.upsert({
        where: { companyId_uniqueid: { companyId: data.companyId, uniqueid: data.uniqueid } },
        update: { extensionId: data.extensionId, number: data.number, ...scoreField },
        create: { companyId: data.companyId, extensionId: data.extensionId, number: data.number, uniqueid: data.uniqueid, ...scoreField },
    })
}

// Nota não tem FK pro CDR (uniqueid é solto, ver schema.prisma) - resolve a gravação na hora do
// download, achando a linha de CDR da mesma chamada (mesmo uniqueid + accountcode da empresa)
export const getRatingRecordingPath = async (ratingId: string, companyId: string) => {
    const company = await getCompanyById(companyId)
    const rating = await prisma.callRating.findUnique({
        where: { id: ratingId },
        select: { companyId: true, uniqueid: true },
    })

    if (!rating || rating.companyId !== companyId || !rating.uniqueid) {
        throw new AppError('Recording not found', 404)
    }

    const cdrRecord = await prisma.cdr.findFirst({
        where: { uniqueid: rating.uniqueid, accountcode: company.asteriskId },
        select: { recordingFile: true },
    })

    if (!cdrRecord?.recordingFile) {
        throw new AppError('Recording not found', 404)
    }

    return cdrRecord.recordingFile
}
