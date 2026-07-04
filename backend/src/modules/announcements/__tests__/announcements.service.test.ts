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
    AnnouncementRepository: { syncEntry: mock(() => Promise.resolve()), removeEntry: mock(() => Promise.resolve()), removeManyByIds: mock(() => Promise.resolve()) },
    announcementSoundDir: (asteriskId: string) => `/var/lib/asterisk/sounds/${asteriskId}`,
    announcementSoundPath: (asteriskId: string, id: string) => `/var/lib/asterisk/sounds/${asteriskId}/${id}`,
}))
mock.module('../../../utils/audio-convert', () => ({
    convertToAsteriskWav: mock(() => Promise.resolve()),
}))
mock.module('fs/promises', () => ({
    mkdir: mock(() => Promise.resolve()),
    rm: mock(() => Promise.resolve()),
    writeFile: mock(() => Promise.resolve()),
}))

import * as AnnouncementsService from '../announcements.service'
import { AnnouncementRepository } from '../../../asterisk/announcement.repository'
import { convertToAsteriskWav } from '../../../utils/audio-convert'

const COMPANY = { id: 'c1', name: 'ACME' }
const ANNOUNCEMENT = { id: 'a1', name: 'Fora do horário', companyId: 'c1', audioUploadedAt: null, createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── createAnnouncement ─────────────────────────────────────────────────────────
describe('AnnouncementsService.createAnnouncement', () => {
    it('creates announcement without audio', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.announcement.findUnique.mockResolvedValue(null)
        db.announcement.create.mockResolvedValue(ANNOUNCEMENT)
        const announcement = await AnnouncementsService.createAnnouncement({ name: 'Fora do horário', companyId: 'c1' })
        expect(announcement.hasAudio).toBe(false)
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
    it('returns hasAudio=true when audioUploadedAt is set', async () => {
        db.announcement.findUnique.mockResolvedValue({ ...ANNOUNCEMENT, audioUploadedAt: new Date() })
        const announcement = await AnnouncementsService.getAnnouncementById('a1') as any
        expect(announcement.hasAudio).toBe(true)
        expect(announcement.audioUploadedAt).toBeUndefined()
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.getAnnouncementById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── uploadAnnouncementAudio ────────────────────────────────────────────────────
describe('AnnouncementsService.uploadAnnouncementAudio', () => {
    it('converts audio, syncs dialplan and marks audioUploadedAt', async () => {
        db.announcement.findUnique.mockResolvedValue({ ...ANNOUNCEMENT, company: { asteriskId: 'ast1' } })
        db.announcement.update.mockResolvedValue({ ...ANNOUNCEMENT, audioUploadedAt: new Date() })

        const announcement = await AnnouncementsService.uploadAnnouncementAudio('a1', Buffer.from('fake-audio'), 'aviso.mp3')

        expect(convertToAsteriskWav).toHaveBeenCalled()
        expect(AnnouncementRepository.syncEntry).toHaveBeenCalledWith(expect.anything(), 'a1', '/var/lib/asterisk/sounds/ast1/a1')
        expect(announcement.hasAudio).toBe(true)
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.uploadAnnouncementAudio('clxxxxxxxxxxxxxxxxxxxxxxxxx', Buffer.from('x'), 'a.wav'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('propagates conversion failure without marking audioUploadedAt', async () => {
        db.announcement.findUnique.mockResolvedValue({ ...ANNOUNCEMENT, company: { asteriskId: 'ast1' } })
        ;(convertToAsteriskWav as any).mockRejectedValueOnce(Object.assign(new Error('bad format'), { statusCode: 422 }))

        await expect(AnnouncementsService.uploadAnnouncementAudio('a1', Buffer.from('x'), 'a.xyz'))
            .rejects.toMatchObject({ statusCode: 422 })
        expect(db.announcement.update).not.toHaveBeenCalled()
    })
})

// ─── deleteAnnouncement ─────────────────────────────────────────────────────────
describe('AnnouncementsService.deleteAnnouncement', () => {
    it('deletes announcement, dialplan entry and audio file', async () => {
        db.announcement.findUnique.mockResolvedValue({ ...ANNOUNCEMENT, company: { asteriskId: 'ast1' } })
        db.announcement.delete.mockResolvedValue(ANNOUNCEMENT)
        await AnnouncementsService.deleteAnnouncement('a1')
        expect(AnnouncementRepository.removeEntry).toHaveBeenCalledWith(expect.anything(), 'a1')
        expect(db.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.announcement.findUnique.mockResolvedValue(null)
        await expect(AnnouncementsService.deleteAnnouncement('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
