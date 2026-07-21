import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/announcements.cache', () => ({
    AnnouncementsCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        getAnnouncement: mock(() => null), setAnnouncement: mock(),
        invalidateAnnouncement: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/announcement.repository', () => ({
    AnnouncementRepository: { regenerate: mock(() => Promise.resolve()) },
}))

// NÃO mockar '../../audios/audios.service' aqui: esse módulo é compartilhado (mesmo caminho
// resolvido) com audios.service.test.ts, que precisa da implementação REAL de
// assertAudioBelongsToCompany — um mock.module parcial nesse specifier vaza pro outro arquivo
// quando o bun roda a suíte inteira no mesmo processo. Em vez disso, deixamos a função real rodar
// contra o `db.audio.findUnique` já mockado abaixo.
import * as AnnouncementsService from '../announcements.service'
import { AnnouncementRepository } from '../../../asterisk/announcement.repository'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const ANNOUNCEMENT = { id: 'a1', name: 'Fora do horário', companyId: 'c1', audioId: null, createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── createAnnouncement ─────────────────────────────────────────────────────────
describe('AnnouncementsService.createAnnouncement', () => {
    it('creates announcement without audio', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.announcement.findUnique.mockResolvedValueOnce(null) // dup check
        db.announcement.create.mockResolvedValue(ANNOUNCEMENT)
        const announcement = await AnnouncementsService.createAnnouncement({ name: 'Fora do horário', companyId: 'c1' })
        expect(announcement.hasAudio).toBe(false)
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('creates announcement with audioId and syncs dialplan', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.announcement.findUnique.mockResolvedValueOnce(null) // dup check
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.announcement.create.mockResolvedValue({ ...ANNOUNCEMENT, audioId: 'audio1' })
        const announcement = await AnnouncementsService.createAnnouncement({ name: 'Fora do horário', companyId: 'c1', audioId: 'audio1' })
        expect(announcement.hasAudio).toBe(true)
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws when audioId is invalid', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.announcement.findUnique.mockResolvedValueOnce(null)
        db.audio.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.createAnnouncement({ name: 'Fora do horário', companyId: 'c1', audioId: 'bad' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.announcement.findUnique.mockResolvedValue(ANNOUNCEMENT)
        await expect(AnnouncementsService.createAnnouncement({ name: 'Fora do horário', companyId: 'c1' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.createAnnouncement({ name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getAnnouncementById ────────────────────────────────────────────────────────
describe('AnnouncementsService.getAnnouncementById', () => {
    it('returns hasAudio=true when audioId is set', async () => {
        db.announcement.findUnique.mockResolvedValue({ ...ANNOUNCEMENT, audioId: 'audio1' })
        db.flowEdge.findMany.mockResolvedValue([])
        const announcement = await AnnouncementsService.getAnnouncementById('a1') as any
        expect(announcement.hasAudio).toBe(true)
        expect(announcement.audioId).toBe('audio1')
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.getAnnouncementById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateAnnouncement ─────────────────────────────────────────────────────────
describe('AnnouncementsService.updateAnnouncement', () => {
    it('links a new audioId and syncs dialplan', async () => {
        db.announcement.findUnique.mockResolvedValueOnce({ ...ANNOUNCEMENT }) // existing
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([])
        db.announcement.update.mockResolvedValue({ ...ANNOUNCEMENT, audioId: 'audio1' })
        const announcement = await AnnouncementsService.updateAnnouncement('a1', { audioId: 'audio1' })
        expect(announcement.hasAudio).toBe(true)
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('unlinks audioId and keeps dialplan with hangup', async () => {
        db.announcement.findUnique.mockResolvedValueOnce({ ...ANNOUNCEMENT, audioId: 'audio1' }) // existing
        db.flowEdge.findMany.mockResolvedValue([])
        db.announcement.update.mockResolvedValue({ ...ANNOUNCEMENT, audioId: null })
        const announcement = await AnnouncementsService.updateAnnouncement('a1', { audioId: null })
        expect(announcement.hasAudio).toBe(false)
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.updateAnnouncement('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteAnnouncement ─────────────────────────────────────────────────────────
describe('AnnouncementsService.deleteAnnouncement', () => {
    it('deletes announcement and dialplan entry', async () => {
        db.announcement.findUnique.mockResolvedValue({ id: 'a1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia — assertNotReferenced passa
        db.announcement.delete.mockResolvedValue(ANNOUNCEMENT)
        await AnnouncementsService.deleteAnnouncement('a1')
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.deleteAnnouncement('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.announcement.findUnique.mockResolvedValue({ id: 'a1', companyId: 'c1' })
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(AnnouncementsService.deleteAnnouncement('a1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.announcement.delete).not.toHaveBeenCalled()
    })
})
