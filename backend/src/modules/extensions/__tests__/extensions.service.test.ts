import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as ExtensionsService from '../extensions.service'

const PREFIX = `__test_ext_svc_${Date.now()}__`

let userId: string
let companyId: string
let asteriskId: string
let sipId: string
let pjsipId: string

const cleanupAsteriskByCompany = async () => {
    const numbers = await prisma.extension.findMany({
        where: { companyId },
        select: { number: true, context: true },
    })

    for (const { number, context } of numbers) {
        await prisma.extensions.deleteMany({ where: { context, exten: number } })
        await prisma.$executeRaw`DELETE FROM ps_endpoints WHERE id = ${number}`
        await prisma.$executeRaw`DELETE FROM ps_auths WHERE id = ${number}`
        await prisma.$executeRaw`DELETE FROM ps_aors WHERE id = ${number}`
        await prisma.sip_peers.deleteMany({ where: { name: number } })
    }

    await prisma.extension.deleteMany({ where: { companyId } })
}

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: { name: 'Test', username: `${PREFIX}@test.com`, password: 'x', role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: { name: `${PREFIX} Company`, metadata: {}, users: { create: { userId } } },
    })
    companyId = company.id
    asteriskId = company.asteriskId
})

afterAll(async () => {
    await cleanupAsteriskByCompany()
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await teardownTestEnv(PREFIX)
})

// ----------------------------------------------------- createExtension SIP
describe('ExtensionsService.createExtension (sip)', () => {
    it('creates extension sip + sip_peers + dialplan', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2001',
            type: 'sip',
            name: 'Test SIP',
            companyId,
            context: 'ramais',
        }) as any

        sipId = ext.id

        expect(ext.alias).toBe('2001')
        expect(ext.type).toBe('sip')
        expect(ext.username).toBe(`2001_${asteriskId}`)
        expect(ext.number).toBeUndefined()

        const peer = await prisma.sip_peers.findUnique({ where: { name: ext.username } })
        expect(peer).not.toBeNull()
        expect(peer?.secret).toMatch(/^[a-zA-Z0-9]{16,30}$/)
        expect(peer?.port).toBe('5062')

        const dialplan = await prisma.extensions.findMany({ where: { exten: ext.username } })
        expect(dialplan.length).toBe(2)
    })

    it('throws 409 with duplicate alias in the same company', async () => {
        await expect(
            ExtensionsService.createExtension({
                alias: '2001',
                type: 'sip',
                name: 'Dup',
                companyId,
                context: 'ramais',
            })
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        await expect(
            ExtensionsService.createExtension({
                alias: '2099',
                type: 'sip',
                name: 'Nope',
                companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
                context: 'ramais',
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------- createExtension PJSIP
describe('ExtensionsService.createExtension (pjsip)', () => {
    it('creates extension pjsip + ps_aors/auths/endpoints + dialplan', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2002',
            type: 'pjsip',
            name: 'Test PJSIP',
            companyId,
            context: 'ramais',
        }) as any

        pjsipId = ext.id
        const number = ext.username

        expect(ext.type).toBe('pjsip')
        expect(number).toBe(`2002_${asteriskId}`)

        const aor = await prisma.ps_aors.findUnique({ where: { id: number } })
        const auth = await prisma.ps_auths.findUnique({ where: { id: number } })
        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: number } })

        expect(aor).not.toBeNull()
        expect(auth?.password).toMatch(/^[a-zA-Z0-9]{16,30}$/)
        expect(endpoint?.callerid).toBe(`Test PJSIP <${number}>`)

        const dialplan = await prisma.extensions.findMany({ where: { exten: number } })
        expect(dialplan.length).toBe(2)
        expect(dialplan.some((d) => d.appdata?.startsWith(`PJSIP/${number}`))).toBe(true)
    })
})

// ----------------------------------------- createExtension PJSIP named groups
describe('ExtensionsService.createExtension (pjsip) named groups', () => {
    it('prefixes namedcallgroup and namedpickupgroup with asteriskId', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2003',
            type: 'pjsip',
            name: 'PJSIP Groups',
            companyId,
            context: 'ramais',
            namedcallgroup: 'suporte',
            namedpickupgroup: 'suporte',
        }) as any

        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.namedcallgroup).toBe(`${asteriskId}-suporte`)
        expect(endpoint?.namedpickupgroup).toBe(`${asteriskId}-suporte`)
    })

    it('prefixes each group in comma-separated namedcallgroup on create', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2004',
            type: 'pjsip',
            name: 'PJSIP Multi Groups',
            companyId,
            context: 'ramais',
            namedcallgroup: 'suporte,financeiro',
            namedpickupgroup: 'suporte',
        }) as any

        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.namedcallgroup).toBe(`${asteriskId}-suporte,${asteriskId}-financeiro`)
        expect(endpoint?.namedpickupgroup).toBe(`${asteriskId}-suporte`)
    })

    it('leaves namedcallgroup/namedpickupgroup null when not provided', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2005',
            type: 'pjsip',
            name: 'PJSIP No Groups',
            companyId,
            context: 'ramais',
        }) as any

        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.namedcallgroup).toBeNull()
        expect(endpoint?.namedpickupgroup).toBeNull()
    })
})

// -------------------------------------------------------- getAllExtensions
describe('ExtensionsService.getAllExtensions', () => {
    it('returns grouped sip/pjsip filtered by companyId', async () => {
        const grouped = await ExtensionsService.getAllExtensions([companyId]) as { sip: any[]; pjsip: any[] }

        expect(Array.isArray(grouped.sip)).toBe(true)
        expect(Array.isArray(grouped.pjsip)).toBe(true)
        expect(grouped.sip.some((e) => e.alias === '2001')).toBe(true)
        expect(grouped.pjsip.some((e) => e.alias === '2002')).toBe(true)
    })
})

// --------------------------------------------------------- getExtensionById
describe('ExtensionsService.getExtensionById', () => {
    it('returns extension by id', async () => {
        const ext = await ExtensionsService.getExtensionById(sipId)
        expect(ext.id).toBe(sipId)
        expect(ext.alias).toBe('2001')
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            ExtensionsService.getExtensionById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ----------------------------------------------------------- updateExtension
describe('ExtensionsService.updateExtension (sip)', () => {
    it('updates name on extension', async () => {
        const ext = await ExtensionsService.updateExtension(sipId, { name: 'SIP Renamed' }) as any
        expect(ext.name).toBe('SIP Renamed')
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            ExtensionsService.updateExtension('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('ExtensionsService.updateExtension (pjsip)', () => {
    it('updates callerid on ps_endpoints and name on extension', async () => {
        const ext = await ExtensionsService.updateExtension(pjsipId, { name: 'PJSIP Renamed' }) as any

        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.callerid).toBe(`PJSIP Renamed <${ext.username}>`)
    })

    it('prefixes namedcallgroup and namedpickupgroup with asteriskId on update', async () => {
        await ExtensionsService.updateExtension(pjsipId, {
            namedcallgroup: 'suporte',
            namedpickupgroup: 'suporte',
        })

        const ext = await ExtensionsService.getExtensionById(pjsipId) as any
        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.namedcallgroup).toBe(`${asteriskId}-suporte`)
        expect(endpoint?.namedpickupgroup).toBe(`${asteriskId}-suporte`)
    })

    it('prefixes each group in comma-separated namedcallgroup', async () => {
        await ExtensionsService.updateExtension(pjsipId, {
            namedcallgroup: 'suporte,financeiro',
        })

        const ext = await ExtensionsService.getExtensionById(pjsipId) as any
        const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })
        expect(endpoint?.namedcallgroup).toBe(`${asteriskId}-suporte,${asteriskId}-financeiro`)
    })
})

// ----------------------------------------------------------- resetExtensionPassword
describe('ExtensionsService.resetExtensionPassword', () => {
    it('generates and persists new password for sip', async () => {
        const { password } = await ExtensionsService.resetExtensionPassword(sipId)

        expect(password.length).toBeGreaterThanOrEqual(16)
        const ext = await ExtensionsService.getExtensionById(sipId) as any
        const peer = await prisma.sip_peers.findUnique({ where: { name: ext.username } })
        expect(peer?.secret).toBe(password)
    })

    it('generates and persists new password for pjsip', async () => {
        const { password } = await ExtensionsService.resetExtensionPassword(pjsipId)

        expect(password.length).toBeGreaterThanOrEqual(16)
        const ext = await ExtensionsService.getExtensionById(pjsipId) as any
        const auth = await prisma.ps_auths.findUnique({ where: { id: ext.username } })
        expect(auth?.password).toBe(password)
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            ExtensionsService.resetExtensionPassword('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------------- deleteExtension
describe('ExtensionsService.deleteExtension', () => {
    it('deletes sip + full cleanup', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2010',
            type: 'sip',
            name: 'To Delete',
            companyId,
            context: 'ramais',
        }) as any

        await ExtensionsService.deleteExtension(ext.id)

        expect(await prisma.extension.findUnique({ where: { id: ext.id } })).toBeNull()
        expect(await prisma.sip_peers.findUnique({ where: { name: ext.username } })).toBeNull()
        expect(await prisma.extensions.findMany({ where: { exten: ext.username } })).toEqual([])
    })

    it('deletes pjsip + full cleanup', async () => {
        const ext = await ExtensionsService.createExtension({
            alias: '2011',
            type: 'pjsip',
            name: 'To Delete',
            companyId,
            context: 'ramais',
        }) as any

        await ExtensionsService.deleteExtension(ext.id)

        expect(await prisma.extension.findUnique({ where: { id: ext.id } })).toBeNull()
        expect(await prisma.ps_aors.findUnique({ where: { id: ext.username } })).toBeNull()
        expect(await prisma.ps_auths.findUnique({ where: { id: ext.username } })).toBeNull()
        expect(await prisma.ps_endpoints.findUnique({ where: { id: ext.username } })).toBeNull()
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            ExtensionsService.deleteExtension('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
