import { describe, expect, it } from 'bun:test'
import { mapId, mapIdOptional, remapDestination, remapResourceId, hasDestination, type IdMap } from '../remap'
import { AppError } from '../../../utils/errors/app.error'

describe('backup remap', () => {
    it('mapId resolves a previously registered id', () => {
        const idMap: IdMap = new Map([['extension:old-1', 'new-1']])
        expect(mapId(idMap, 'extension', 'old-1')).toBe('new-1')
    })

    it('mapId throws AppError when the reference was never created', () => {
        const idMap: IdMap = new Map()
        expect(() => mapId(idMap, 'extension', 'missing')).toThrow(AppError)
    })

    it('mapIdOptional returns null for null/undefined without touching the map', () => {
        const idMap: IdMap = new Map()
        expect(mapIdOptional(idMap, 'audio', null)).toBeNull()
        expect(mapIdOptional(idMap, 'audio', undefined)).toBeNull()
    })

    it('remapDestination returns null for hangup and for null/undefined', () => {
        const idMap: IdMap = new Map()
        expect(remapDestination(idMap, null)).toBeNull()
        expect(remapDestination(idMap, undefined)).toBeNull()
        expect(remapDestination(idMap, { type: 'hangup' })).toBeNull()
    })

    it('remapDestination passes voicemail through unchanged (no FK to remap)', () => {
        const idMap: IdMap = new Map()
        expect(remapDestination(idMap, { type: 'voicemail', id: '1001' })).toEqual({
            type: 'voicemail',
            id: '1001'
        })
    })

    it('remapDestination rewrites the id of an FK-backed type using the id map', () => {
        const idMap: IdMap = new Map([['queue:old-queue', 'new-queue']])
        expect(remapDestination(idMap, { type: 'queue', id: 'old-queue' })).toEqual({
            type: 'queue',
            id: 'new-queue'
        })
    })

    it('remapDestination throws when the referenced entity was never created (broken backup file)', () => {
        const idMap: IdMap = new Map()
        expect(() => remapDestination(idMap, { type: 'queue', id: 'ghost' })).toThrow(AppError)
    })

    it('remapResourceId mirrors remapDestination for FlowNode types, voicemail/hangup untouched', () => {
        const idMap: IdMap = new Map([['ivrMenu:old-ivr', 'new-ivr']])
        expect(remapResourceId(idMap, 'ivr', 'old-ivr')).toBe('new-ivr')
        expect(remapResourceId(idMap, 'voicemail', '1001')).toBe('1001')
        expect(remapResourceId(idMap, 'hangup', null)).toBeNull()
    })

    it('hasDestination distinguishes a real destination from hangup/empty', () => {
        expect(hasDestination(null)).toBe(false)
        expect(hasDestination(undefined)).toBe(false)
        expect(hasDestination({ type: 'hangup' })).toBe(false)
        expect(hasDestination({ type: 'extension', id: 'x' })).toBe(true)
    })
})
