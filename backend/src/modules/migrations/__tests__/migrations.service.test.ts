import { spyOn, describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AppError } from '../../../utils/errors/app.error'
import * as ArchiveModule from '../archive'
import * as FsPromises from 'fs/promises'
import * as CompaniesService from '../../companies/companies.service'
import * as ExtensionsService from '../../extensions/extensions.service'
import * as TrunksService from '../../trunks/trunks.service'
import * as QueuesService from '../../queues/queues.service'
import * as QueueMembersService from '../../queue-members/queue-members.service'
import { importIssabelBackup } from '../migrations.service'

// migrations.service.ts importa createExtension/createTrunk/createQueue/addMember/getCompanyById
// diretamente dos módulos irmãos - esses módulos JÁ têm teste unit dedicado com comportamento real
// testado contra prisma mockado. Usar mock.module() pra substituir o módulo inteiro aqui mutaria o
// objeto de exports compartilhado pelo processo inteiro do bun test, quebrando os describes desses
// outros arquivos que dependem da implementação real. Em vez disso, usamos spyOn(...).mockImplementation
// escopado a beforeEach/afterEach de cada teste - a mutação existe só durante a execução síncrona
// deste it(), e mockRestore() devolve a função real antes do runner seguir pro próximo teste (mesmo
// mecanismo do mock.module, só que sem vazar pra fora da janela de execução deste describe).

// SQL fixture: 2 devices (2001 ok, 2002 vai falhar - alias duplicado simulado no spy), 1 trunk
// (peer dinâmico), 1 fila com 3 membros (sip importado, sip não importado, agent)
const SQL_FIXTURE = `
INSERT INTO \`devices\` (\`id\`,\`tech\`,\`c3\`,\`c4\`,\`c5\`,\`description\`) VALUES
('2001','sip','x','y','z','Ramal 2001'),
('2002','sip','x','y','z','Ramal 2002');

INSERT INTO \`users\` (\`extension\`,\`c2\`,\`name\`) VALUES
('2001','x','Fulano'),
('2002','x','Ciclano');

INSERT INTO \`sip\` (\`id\`,\`keyword\`,\`data\`) VALUES
('2001','allow','ulaw&alaw'),
('2002','allow','ulaw'),
('tr-peer-1','host','dynamic'),
('tr-peer-1','username','trunkuser'),
('tr-peer-1','secret','trunksecret'),
('tr-peer-1','allow','ulaw&alaw');

INSERT INTO \`queues_config\` (\`extension\`,\`descr\`) VALUES
('600','Fila Suporte');

INSERT INTO \`queues_details\` (\`id\`,\`keyword\`,\`data\`) VALUES
('600','strategy','ringall'),
('600','member','SIP/2001,1'),
('600','member','SIP/2099,0'),
('600','member','Agent/50,0');

INSERT INTO \`trunks\` (\`trunkid\`,\`name\`,\`tech\`) VALUES
('1','tronco-principal','sip');
`

const COMPANY_ID = 'company1'
const UPLOAD_PATH = '/tmp/upload-fake.tar'

let extractMemberSpy: ReturnType<typeof spyOn>
let readFileSpy: ReturnType<typeof spyOn>
let rmSpy: ReturnType<typeof spyOn>
let getCompanyByIdSpy: ReturnType<typeof spyOn>
let createExtensionSpy: ReturnType<typeof spyOn>
let createTrunkSpy: ReturnType<typeof spyOn>
let createQueueSpy: ReturnType<typeof spyOn>
let addMemberSpy: ReturnType<typeof spyOn>

beforeEach(() => {
    extractMemberSpy = spyOn(ArchiveModule, 'extractMember').mockImplementation(
        ((_archivePath: string, destDir: string) => Promise.resolve(`${destDir}/fake`)) as any,
    )
    readFileSpy = spyOn(FsPromises, 'readFile').mockImplementation((() => Promise.resolve(SQL_FIXTURE)) as any)
    rmSpy = spyOn(FsPromises, 'rm').mockImplementation((() => Promise.resolve()) as any)
    getCompanyByIdSpy = spyOn(CompaniesService, 'getCompanyById').mockImplementation(
        (() => Promise.resolve({ id: COMPANY_ID, asteriskId: 'ast1' })) as any,
    )
    createExtensionSpy = spyOn(ExtensionsService, 'createExtension').mockImplementation(((input: any) => {
        if (input.alias === '2002') return Promise.reject(new AppError('Alias já cadastrado', 409))
        return Promise.resolve({ id: `extid${input.alias}` })
    }) as any)
    createTrunkSpy = spyOn(TrunksService, 'createTrunk').mockImplementation((() => Promise.resolve({ id: 'trunkid1' })) as any)
    createQueueSpy = spyOn(QueuesService, 'createQueue').mockImplementation((() => Promise.resolve({ id: 'queueid600' })) as any)
    addMemberSpy = spyOn(QueueMembersService, 'addMember').mockImplementation((() => Promise.resolve({ id: 'memberid1' })) as any)
})

afterEach(() => {
    extractMemberSpy.mockRestore()
    readFileSpy.mockRestore()
    rmSpy.mockRestore()
    getCompanyByIdSpy.mockRestore()
    createExtensionSpy.mockRestore()
    createTrunkSpy.mockRestore()
    createQueueSpy.mockRestore()
    addMemberSpy.mockRestore()
})

describe('importIssabelBackup', () => {
    it('imports extensions, trunks and queues, returning per-category counts', async () => {
        const summary = await importIssabelBackup(COMPANY_ID, UPLOAD_PATH)

        expect(summary.extensions.created).toBe(1)
        expect(summary.trunks.created).toBe(1)
        expect(summary.queues.created).toBe(1)
        expect(createExtensionSpy).toHaveBeenCalledTimes(2)
        expect(createTrunkSpy).toHaveBeenCalledTimes(1)
        expect(createQueueSpy).toHaveBeenCalledTimes(1)
    })

    it('keeps importing when one extension fails, reporting the error as a warning', async () => {
        const summary = await importIssabelBackup(COMPANY_ID, UPLOAD_PATH)

        expect(summary.extensions.created).toBe(1)
        expect(summary.extensions.warnings).toHaveLength(1)
        expect(summary.extensions.warnings[0]).toContain('Ramal 2002')
        expect(summary.extensions.warnings[0]).toContain('Alias já cadastrado')
    })

    it('counts an Agent/ queue member as skipped, without calling addMember for it', async () => {
        const summary = await importIssabelBackup(COMPANY_ID, UPLOAD_PATH)

        expect(summary.queueMembers.skippedAgents).toBe(1)
        // só o membro SIP/2001 (importado) deve gerar chamada a addMember - Agent/50 é só contado
        expect(addMemberSpy).toHaveBeenCalledTimes(1)
    })

    it('warns and skips a sip member whose extension was not imported, without calling addMember', async () => {
        const summary = await importIssabelBackup(COMPANY_ID, UPLOAD_PATH)

        expect(summary.queueMembers.created).toBe(1)
        expect(summary.queueMembers.warnings).toHaveLength(1)
        expect(summary.queueMembers.warnings[0]).toContain('2099')
        expect(addMemberSpy).toHaveBeenCalledTimes(1)
        expect(addMemberSpy).toHaveBeenCalledWith('queueid600', expect.objectContaining({ extensionId: 'extid2001', penalty: 1 }))
    })

    it('cleans up workDir and uploadPath via rm in the finally block', async () => {
        await importIssabelBackup(COMPANY_ID, UPLOAD_PATH)

        const rmPaths: unknown[] = rmSpy.mock.calls.map((call: unknown[]) => call[0])
        expect(rmPaths).toContain(UPLOAD_PATH)
        expect(rmPaths.some((p: unknown) => typeof p === 'string' && p.includes('issabel-import-'))).toBe(true)
    })

    it('still calls rm in finally when extraction fails mid-import', async () => {
        extractMemberSpy.mockImplementationOnce(() => Promise.reject(new AppError('Backup inválido', 422)))

        await expect(importIssabelBackup(COMPANY_ID, UPLOAD_PATH)).rejects.toMatchObject({ statusCode: 422 })

        const rmPaths: unknown[] = rmSpy.mock.calls.map((call: unknown[]) => call[0])
        expect(rmPaths).toContain(UPLOAD_PATH)
        expect(rmPaths.some((p: unknown) => typeof p === 'string' && p.includes('issabel-import-'))).toBe(true)
    })
})
