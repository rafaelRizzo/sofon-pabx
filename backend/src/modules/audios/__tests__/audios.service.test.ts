import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/audios.cache', () => ({
    AudiosCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        getAudio: mock(() => null), setAudio: mock(),
        invalidateAudio: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/audio.repository', () => ({
    audioSoundDir: (asteriskId: string) => `/var/lib/asterisk/sounds/${asteriskId}`,
    audioSoundPath: (asteriskId: string, id: string) => `/var/lib/asterisk/sounds/${asteriskId}/${id}`,
}))
mock.module('../../../asterisk/announcement.repository', () => ({
    AnnouncementRepository: { regenerate: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/ivr.repository', () => ({
    IvrRepository: { regenerate: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/queue.repository', () => ({
    AsteriskQueueRepository: {
        updateQueue: mock(() => Promise.resolve()),
        regenerate: mock(() => Promise.resolve()),
    },
    toAsteriskQueueName: (asteriskId: string, queueName: string) => `${asteriskId}-${queueName}`,
}))
mock.module('../../announcements/cache/announcements.cache', () => ({
    AnnouncementsCache: {
        invalidateAnnouncement: mock(), invalidateByCompany: mock(),
    },
}))
mock.module('../../ivr/cache/ivr.cache', () => ({
    IvrCache: {
        invalidateMenu: mock(), invalidateByCompany: mock(),
    },
}))
mock.module('../../queues/cache/queues.cache', () => ({
    QueuesCache: {
        invalidateQueue: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../../utils/audio-convert', () => ({
    convertToAsteriskWav: mock(() => Promise.resolve()),
}))
mock.module('fs/promises', () => ({
    mkdir: mock(() => Promise.resolve()),
    rm: mock(() => Promise.resolve()),
    writeFile: mock(() => Promise.resolve()),
}))

import * as AudiosService from '../audios.service'
import { AnnouncementRepository } from '../../../asterisk/announcement.repository'
import { IvrRepository } from '../../../asterisk/ivr.repository'
import { AsteriskQueueRepository } from '../../../asterisk/queue.repository'
import { convertToAsteriskWav } from '../../../utils/audio-convert'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const AUDIO = { id: 'audio1', name: 'saudação', companyId: 'c1', createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => {
    clearPrismaMock(db)
    ;(AsteriskQueueRepository.updateQueue as any).mockClear()
    ;(AsteriskQueueRepository.regenerate as any).mockClear()
})

// ─── assertAudioBelongsToCompany ────────────────────────────────────────────────
describe('AudiosService.assertAudioBelongsToCompany', () => {
    it('resolves when audioId is null/undefined', async () => {
        await expect(AudiosService.assertAudioBelongsToCompany(null, 'c1')).resolves.toBeUndefined()
        await expect(AudiosService.assertAudioBelongsToCompany(undefined, 'c1')).resolves.toBeUndefined()
    })

    it('throws 404 when audio does not exist', async () => {
        db.audio.findUnique.mockResolvedValue(null)
        await expect(AudiosService.assertAudioBelongsToCompany('audio1', 'c1'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when audio belongs to a different company', async () => {
        db.audio.findUnique.mockResolvedValue({ companyId: 'other' })
        await expect(AudiosService.assertAudioBelongsToCompany('audio1', 'c1'))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('resolves when audio belongs to the company', async () => {
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        await expect(AudiosService.assertAudioBelongsToCompany('audio1', 'c1')).resolves.toBeUndefined()
    })
})

// ─── createAudio ─────────────────────────────────────────────────────────────────
describe('AudiosService.createAudio', () => {
    it('creates the record and converts the file', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.audio.findUnique.mockResolvedValue(null)
        db.audio.create.mockResolvedValue(AUDIO)

        const audio = await AudiosService.createAudio('c1', 'saudação', Buffer.from('fake-audio'), 'saudacao.mp3')

        expect(convertToAsteriskWav).toHaveBeenCalledWith(expect.any(String), '/var/lib/asterisk/sounds/ast1/audio1.wav')
        expect(audio.id).toBe('audio1')
    })

    it('throws 409 with duplicate name in the same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.audio.findUnique.mockResolvedValue(AUDIO)
        await expect(AudiosService.createAudio('c1', 'saudação', Buffer.from('x'), 'a.mp3'))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(AudiosService.createAudio('clxxxxxxxxxxxxxxxxxxxxxxxxx', 'x', Buffer.from('x'), 'a.mp3'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('rolls back the created row when conversion fails', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.audio.findUnique.mockResolvedValue(null)
        db.audio.create.mockResolvedValue(AUDIO)
        db.audio.delete.mockResolvedValue(AUDIO)
        ;(convertToAsteriskWav as any).mockRejectedValueOnce(Object.assign(new Error('bad format'), { statusCode: 422 }))

        await expect(AudiosService.createAudio('c1', 'saudação', Buffer.from('x'), 'a.xyz'))
            .rejects.toMatchObject({ statusCode: 422 })
        expect(db.audio.delete).toHaveBeenCalledWith({ where: { id: 'audio1' } })
    })
})

// ─── updateAudio ─────────────────────────────────────────────────────────────────
describe('AudiosService.updateAudio', () => {
    it('renames the audio', async () => {
        db.audio.findUnique.mockResolvedValueOnce(AUDIO).mockResolvedValueOnce(null)
        db.audio.update.mockResolvedValue({ ...AUDIO, name: 'novo-nome' })
        const audio = await AudiosService.updateAudio('audio1', { name: 'novo-nome' })
        expect(audio.name).toBe('novo-nome')
    })

    it('throws 409 when renaming to a name already in use', async () => {
        db.audio.findUnique.mockResolvedValueOnce(AUDIO).mockResolvedValueOnce({ ...AUDIO, id: 'audio2' })
        await expect(AudiosService.updateAudio('audio1', { name: 'ocupado' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent id', async () => {
        db.audio.findUnique.mockResolvedValue(null)
        await expect(AudiosService.updateAudio('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteAudio ─────────────────────────────────────────────────────────────────
describe('AudiosService.deleteAudio', () => {
    it('deletes the record and file when unreferenced', async () => {
        db.audio.findUnique.mockResolvedValue({ ...AUDIO, company: { asteriskId: 'ast1' } })
        db.announcement.findMany.mockResolvedValue([])
        db.ivrMenu.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([])
        await AudiosService.deleteAudio('audio1')
        expect(db.audio.delete).toHaveBeenCalledWith({ where: { id: 'audio1' } })
        expect(AnnouncementRepository.regenerate).not.toHaveBeenCalled()
        expect(IvrRepository.regenerate).not.toHaveBeenCalled()
    })

    it('unlinks referencing announcements and ivr menus, removing their dialplan', async () => {
        db.audio.findUnique.mockResolvedValue({ ...AUDIO, company: { asteriskId: 'ast1' } })
        db.announcement.findMany.mockResolvedValue([{ id: 'a1', companyId: 'c1' }])
        db.ivrMenu.findMany.mockResolvedValue([{ id: 'ivr1', companyId: 'c1' }])
        db.queue.findMany.mockResolvedValue([])
        await AudiosService.deleteAudio('audio1')
        expect(AnnouncementRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(IvrRepository.regenerate).toHaveBeenCalledWith('c1')
        expect(db.audio.delete).toHaveBeenCalledWith({ where: { id: 'audio1' } })
    })

    it('unlinks queues referencing the audio as periodicAnnounce/agentAnnounce in the Asterisk realtime table', async () => {
        const { AsteriskQueueRepository } = await import('../../../asterisk/queue.repository')
        db.audio.findUnique.mockResolvedValue({ ...AUDIO, company: { asteriskId: 'ast1' } })
        db.announcement.findMany.mockResolvedValue([])
        db.ivrMenu.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([
            {
                id: 'q1', name: 'suporte', companyId: 'c1',
                announce: null, periodicAnnounce: 'audio1', agentAnnounce: 'audio1',
                company: { asteriskId: 'ast1' },
            },
        ])
        await AudiosService.deleteAudio('audio1')
        expect(AsteriskQueueRepository.updateQueue).toHaveBeenCalledWith(
            expect.anything(),
            'q1',
            'ast1-suporte',
            'ast1-suporte',
            { periodicAnnounce: null, announce: null }
        )
        expect(AsteriskQueueRepository.regenerate).not.toHaveBeenCalled()
    })

    it('regenerates the queue dialplan when the audio was used as the join announcement', async () => {
        const { AsteriskQueueRepository } = await import('../../../asterisk/queue.repository')
        db.audio.findUnique.mockResolvedValue({ ...AUDIO, company: { asteriskId: 'ast1' } })
        db.announcement.findMany.mockResolvedValue([])
        db.ivrMenu.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([
            {
                id: 'q1', name: 'suporte', companyId: 'c1',
                announce: 'audio1', periodicAnnounce: null, agentAnnounce: null,
                company: { asteriskId: 'ast1' },
            },
        ])
        await AudiosService.deleteAudio('audio1')
        expect(AsteriskQueueRepository.updateQueue).not.toHaveBeenCalled()
        expect(AsteriskQueueRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.audio.findUnique.mockResolvedValue(null)
        await expect(AudiosService.deleteAudio('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
