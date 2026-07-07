import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/ivr.cache', () => ({
    IvrCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        invalidateByCompany: mock(),
        getMenu: mock(() => null), setMenu: mock(),
        invalidateMenu: mock(),
        invalidateNamespace: mock(),
    },
}))
mock.module('../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { getExtension: mock(() => null), setExtension: mock() },
}))
mock.module('../../../asterisk/ivr.repository', () => ({
    IvrRepository: { regenerate: mock(() => Promise.resolve()) },
}))

// NÃO mockar '../../audios/audios.service' aqui: esse módulo é compartilhado (mesmo caminho
// resolvido) com audios.service.test.ts, que precisa da implementação REAL de
// assertAudioBelongsToCompany — um mock.module parcial nesse specifier vaza pro outro arquivo
// quando o bun roda a suíte inteira no mesmo processo. Em vez disso, deixamos a função real rodar
// contra o `db.audio.findUnique` já mockado abaixo.
import * as IvrService from '../ivr.service'
import { IvrRepository } from '../../../asterisk/ivr.repository'

const COMPANY = { id: 'c1', name: 'ACME' }
const EXT = { id: 'e1', companyId: 'c1', context: 'ramais', number: '1001' }
const MENU = {
    id: 'ivr1', name: 'menu-principal', companyId: 'c1',
    audioId: null as string | null,
    maxDigits: 1, digitTimeout: 5,
    invalidRetries: 3, invalidDestination: null,
    timeoutRetries: 3, timeoutDestination: null,
    longDestination: null,
    company: { asteriskId: 'ast1' },
    options: [] as { digit: string; destination: any }[],
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => {
    clearPrismaMock(db)
    ;(IvrRepository.regenerate as any).mockClear()
})

// ─── getIvrMenusByCompany ───────────────────────────────────────────────────────
describe('IvrService.getIvrMenusByCompany', () => {
    it('returns list of menus', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findMany.mockResolvedValue([MENU])
        const menus = await IvrService.getIvrMenusByCompany('c1') as any[]
        expect(menus[0].id).toBe('ivr1')
        expect(menus[0].hasAudio).toBe(false)
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(IvrService.getIvrMenusByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getIvrMenuById ─────────────────────────────────────────────────────────────
describe('IvrService.getIvrMenuById', () => {
    it('returns hasAudio=true when audioId is set', async () => {
        db.ivrMenu.findUnique.mockResolvedValue({ ...MENU, audioId: 'audio1' })
        const menu = await IvrService.getIvrMenuById('ivr1') as any
        expect(menu.hasAudio).toBe(true)
        expect(menu.audioId).toBe('audio1')
    })

    it('throws 404 with non-existent id', async () => {
        db.ivrMenu.findUnique.mockResolvedValue(null)
        await expect(IvrService.getIvrMenuById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createIvrMenu ──────────────────────────────────────────────────────────────
describe('IvrService.createIvrMenu', () => {
    it('creates menu without destinations', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.ivrMenu.create.mockResolvedValue({ id: 'ivr1' })
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue(MENU)
        const menu = await IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1',
            maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
        }) as any
        expect(menu.id).toBe('ivr1')
        expect(menu.hasAudio).toBe(false)
    })

    it('creates menu with audioId and syncs dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValueOnce(null) // dup check
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.ivrMenu.create.mockResolvedValue({ id: 'ivr1' })
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue({ ...MENU, audioId: 'audio1' })
        const menu = await IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1', audioId: 'audio1',
            maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
        }) as any
        expect(menu.hasAudio).toBe(true)
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws when audioId is invalid', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValueOnce(null)
        db.audio.findUnique.mockResolvedValue(null)
        await expect(IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1', audioId: 'bad',
            maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('creates menu with valid invalidDestination extension', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.ivrMenu.create.mockResolvedValue({ id: 'ivr1' })
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue({ ...MENU, invalidDestination: { type: 'extension', id: 'e1' } })
        const menu = await IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1',
            maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
            invalidDestination: { type: 'extension', id: 'e1' },
        }) as any
        expect(menu.id).toBe('ivr1')
    })

    it('creates menu with digit options already set', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.ivrMenu.create.mockResolvedValue({ id: 'ivr1' })
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue({
            ...MENU, options: [{ id: 'o1', digit: '1', destination: { type: 'extension', id: 'e1' } }],
        })
        const menu = await IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1',
            maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3,
            options: [{ digit: '1', destination: { type: 'extension', id: 'e1' } }],
        }) as any
        expect(db.ivrOption.createMany).toHaveBeenCalled()
        expect(menu.options).toHaveLength(1)
    })

    it('throws 404 when option destination extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(IvrService.createIvrMenu({
            name: 'x', companyId: 'c1', maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3,
            options: [{ digit: '1', destination: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' } }],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when invalidDestination extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(IvrService.createIvrMenu({
            name: 'x', companyId: 'c1', maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
            invalidDestination: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when timeoutDestination extension belongs to different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue({ ...EXT, companyId: 'other' })
        await expect(IvrService.createIvrMenu({
            name: 'x', companyId: 'c1', maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
            timeoutDestination: { type: 'extension', id: 'e1' },
        })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 409 on duplicate name', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.ivrMenu.findUnique.mockResolvedValue(MENU)
        await expect(IvrService.createIvrMenu({
            name: 'menu-principal', companyId: 'c1', maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
        })).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(IvrService.createIvrMenu({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', maxDigits: 1, digitTimeout: 5, invalidRetries: 3, timeoutRetries: 3, options: [],
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateIvrMenu ──────────────────────────────────────────────────────────────
describe('IvrService.updateIvrMenu', () => {
    it('updates name and regenerates dialplan', async () => {
        db.ivrMenu.findUnique.mockResolvedValueOnce(MENU).mockResolvedValueOnce(null)
        db.ivrMenu.update.mockResolvedValue({ ...MENU, name: 'novo-menu' })
        const menu = await IvrService.updateIvrMenu('ivr1', { name: 'novo-menu' }) as any
        expect(menu.name).toBe('novo-menu')
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('resyncs dialplan when audio already linked', async () => {
        const withAudio = { ...MENU, audioId: 'audio1' }
        db.ivrMenu.findUnique.mockResolvedValueOnce(withAudio)
        db.ivrMenu.update.mockResolvedValue({ ...withAudio, digitTimeout: 8 })
        await IvrService.updateIvrMenu('ivr1', { digitTimeout: 8 })
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('links a new audioId and resyncs dialplan', async () => {
        db.ivrMenu.findUnique.mockResolvedValueOnce(MENU) // existing
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.ivrMenu.update.mockResolvedValue({ ...MENU, audioId: 'audio1' })
        const menu = await IvrService.updateIvrMenu('ivr1', { audioId: 'audio1' }) as any
        expect(menu.hasAudio).toBe(true)
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('unlinks audioId and writes hangup dialplan', async () => {
        const withAudio = { ...MENU, audioId: 'audio1' }
        db.ivrMenu.findUnique.mockResolvedValueOnce(withAudio) // existing
        db.ivrMenu.update.mockResolvedValue({ ...MENU, audioId: null })
        const menu = await IvrService.updateIvrMenu('ivr1', { audioId: null }) as any
        expect(menu.hasAudio).toBe(false)
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.ivrMenu.findUnique.mockResolvedValue(null)
        await expect(IvrService.updateIvrMenu('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when renaming to a name already in use', async () => {
        db.ivrMenu.findUnique.mockResolvedValueOnce(MENU).mockResolvedValueOnce({ ...MENU, id: 'ivr2' })
        await expect(IvrService.updateIvrMenu('ivr1', { name: 'ocupado' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('replaces options and resyncs when audio already linked', async () => {
        const withAudio = { ...MENU, audioId: 'audio1' }
        db.ivrMenu.findUnique.mockResolvedValueOnce(withAudio)
        db.ivrMenu.update.mockResolvedValue(withAudio)
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue({
            ...withAudio, options: [{ id: 'o1', digit: '1', destination: { type: 'extension', id: 'e1' } }],
        })
        db.extension.findUnique.mockResolvedValue(EXT)

        const menu = await IvrService.updateIvrMenu('ivr1', { options: [{ digit: '1', destination: { type: 'extension', id: 'e1' } }] }) as any

        expect(db.ivrOption.deleteMany).toHaveBeenCalledWith({ where: { ivrMenuId: 'ivr1' } })
        expect(db.ivrOption.createMany).toHaveBeenCalled()
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(menu.options).toHaveLength(1)
    })

    it('regenerates dialplan when replacing options', async () => {
        db.ivrMenu.findUnique.mockResolvedValueOnce(MENU)
        db.ivrMenu.update.mockResolvedValue(MENU)
        db.ivrMenu.findUniqueOrThrow.mockResolvedValue(MENU)
        await IvrService.updateIvrMenu('ivr1', { options: [] })
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 when option destination extension not found', async () => {
        db.ivrMenu.findUnique.mockResolvedValue(MENU)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(IvrService.updateIvrMenu('ivr1', {
            options: [{ digit: '1', destination: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' } }],
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteIvrMenu ──────────────────────────────────────────────────────────────
describe('IvrService.deleteIvrMenu', () => {
    it('deletes menu and dialplan entry', async () => {
        db.ivrMenu.findUnique.mockResolvedValue({ id: 'ivr1', companyId: 'c1' })
        db.ivrMenu.delete.mockResolvedValue(MENU)
        await IvrService.deleteIvrMenu('ivr1')
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.ivrMenu.delete).toHaveBeenCalledWith({ where: { id: 'ivr1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.ivrMenu.findUnique.mockResolvedValue(null)
        await expect(IvrService.deleteIvrMenu('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
