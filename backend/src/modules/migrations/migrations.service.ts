import { readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getCompanyById } from '../companies/companies.service'
import { createExtension } from '../extensions/extensions.service'
import { createExtensionSchema } from '../extensions/schemas/extension.schema'
import { createTrunk } from '../trunks/trunks.service'
import { createTrunkSchema } from '../trunks/schemas/trunk.schema'
import { createQueue } from '../queues/queues.service'
import { createQueueSchema } from '../queues/schemas/queue.schema'
import { addMember } from '../queue-members/queue-members.service'
import { addMemberSchema } from '../queue-members/schemas/queue-member.schema'
import { AppError } from '../../utils/errors/app.error'
import { extractMember } from './archive'
import { parseIssabelDump } from './providers/issabel/issabel.parser'
import { mapExtensions, mapTrunks, mapQueues } from './providers/issabel/issabel.mapper'
import type { ImportSummary } from './schemas/migration.schema'

const errMsg = (error: unknown) =>
    error instanceof AppError ? error.message : error instanceof Error ? error.message : String(error)

// O frontend extrai o asterisk.sql do backup no navegador antes do upload (ver
// frontend/src/lib/issabel-extract.ts), pra nunca subir os GBs de gravação/voicemail que um
// backup completo pode ter. Mas a API aceita os dois formatos - quem chamar direto (sem passar
// pelo navegador, ex: script/curl) pode mandar o .tar/.tgz completo, que é extraído aqui mesmo.
const resolveSqlContent = async (uploadPath: string, workDir: string): Promise<string> => {
    if (uploadPath.toLowerCase().endsWith('.sql')) return readFile(uploadPath, 'utf-8')

    const dumpArchive = await extractMember(
        uploadPath,
        join(workDir, 'db'),
        /mysqldb_asterisk[^/]*\.(tgz|tar\.gz)$/i,
        'Backup do Issabel inválido: dump do banco "asterisk" (mysqldb_asterisk.tgz) não encontrado dentro do arquivo enviado',
    )
    const sqlPath = await extractMember(
        dumpArchive,
        join(workDir, 'sql'),
        /(^|\/)asterisk\.sql$/i,
        'Backup do Issabel inválido: asterisk.sql não encontrado dentro do dump do banco',
    )
    return readFile(sqlPath, 'utf-8')
}

export const importIssabelBackup = async (companyId: string, uploadPath: string): Promise<ImportSummary> => {
    await getCompanyById(companyId)

    const workDir = join(tmpdir(), `issabel-import-${randomUUID()}`)

    try {
        const sql = await resolveSqlContent(uploadPath, workDir)
        const parsed = parseIssabelDump(sql)

        const extensionIdByIssabelNumber = new Map<string, string>()
        const extensionsResult = { created: 0, warnings: [] as string[] }
        const { extensions, skipped: skippedExtensions } = mapExtensions(parsed, companyId)
        extensionsResult.warnings.push(...skippedExtensions)

        for (const { issabelId, input } of extensions) {
            try {
                const created = await createExtension(createExtensionSchema.parse(input))
                extensionIdByIssabelNumber.set(issabelId, created.id)
                extensionsResult.created++
            } catch (error) {
                extensionsResult.warnings.push(`Ramal ${issabelId}: ${errMsg(error)}`)
            }
        }

        const trunksResult = { created: 0, warnings: [] as string[] }
        const { trunks, skipped: skippedTrunks } = mapTrunks(parsed, companyId)
        trunksResult.warnings.push(...skippedTrunks)

        for (const { issabelId, input } of trunks) {
            try {
                await createTrunk(createTrunkSchema.parse(input))
                trunksResult.created++
            } catch (error) {
                trunksResult.warnings.push(`Tronco ${issabelId}: ${errMsg(error)}`)
            }
        }

        const queuesResult = { created: 0, warnings: [] as string[] }
        const queueMembersResult = { created: 0, warnings: [] as string[], skippedAgents: 0 }
        const { queues, skipped: skippedQueues } = mapQueues(parsed, companyId)
        queuesResult.warnings.push(...skippedQueues)

        for (const { issabelId, input, members } of queues) {
            let queueId: string
            try {
                const created = await createQueue(createQueueSchema.parse(input))
                queueId = created.id
                queuesResult.created++
            } catch (error) {
                queuesResult.warnings.push(`Fila ${issabelId}: ${errMsg(error)}`)
                continue
            }

            for (const member of members) {
                if (member.kind === 'agent') {
                    queueMembersResult.skippedAgents++
                    continue
                }
                if (member.kind !== 'sip' || !member.number) continue

                const extensionId = extensionIdByIssabelNumber.get(member.number)
                if (!extensionId) {
                    queueMembersResult.warnings.push(`Fila ${issabelId}: ramal ${member.number} não foi importado, membro pulado`)
                    continue
                }
                try {
                    await addMember(queueId, addMemberSchema.parse({ extensionId, penalty: member.penalty }))
                    queueMembersResult.created++
                } catch (error) {
                    queueMembersResult.warnings.push(`Fila ${issabelId}, ramal ${member.number}: ${errMsg(error)}`)
                }
            }
        }

        return { extensions: extensionsResult, trunks: trunksResult, queues: queuesResult, queueMembers: queueMembersResult }
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => {})
        await rm(uploadPath, { force: true }).catch(() => {})
    }
}
