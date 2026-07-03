import { describe, it, expect } from 'bun:test'
import { toTzISOString, formatDatesDeep, collectCompanyIds } from '../timezone'

describe('toTzISOString', () => {
    it('formats with negative offset (America/Sao_Paulo)', () => {
        const date = new Date('2026-01-15T12:00:00Z')
        expect(toTzISOString(date, 'America/Sao_Paulo')).toBe('2026-01-15T09:00:00-03:00')
    })

    it('formats with positive offset (Europe/Lisbon in DST)', () => {
        const date = new Date('2026-07-15T12:00:00Z')
        expect(toTzISOString(date, 'Europe/Lisbon')).toBe('2026-07-15T13:00:00+01:00')
    })
})

describe('collectCompanyIds', () => {
    it('collects companyId from nested objects and arrays', () => {
        const payload = {
            records: [{ id: '1', companyId: 'c1' }, { id: '2', companyId: 'c2' }],
            nested: { deep: { companyId: 'c1' } },
        }
        expect(collectCompanyIds(payload)).toEqual(new Set(['c1', 'c2']))
    })

    it('returns empty set when no companyId is present', () => {
        expect(collectCompanyIds({ id: '1', name: 'x' })).toEqual(new Set())
    })
})

describe('formatDatesDeep', () => {
    const date = new Date('2026-01-15T12:00:00Z')

    it('uses the default timeZone when no companyId is present', () => {
        const result = formatDatesDeep({ createdAt: date }, 'America/Sao_Paulo') as any
        expect(result.createdAt).toBe('2026-01-15T09:00:00-03:00')
    })

    it('resolves per-record timezone via companyId against the provided map', () => {
        const tzByCompanyId = new Map([['c1', 'Asia/Tokyo']])
        const result = formatDatesDeep(
            { companyId: 'c1', createdAt: date, nested: { updatedAt: date } },
            'America/Sao_Paulo',
            tzByCompanyId,
        ) as any
        expect(result.createdAt).toBe('2026-01-15T21:00:00+09:00')
        expect(result.nested.updatedAt).toBe('2026-01-15T21:00:00+09:00')
    })

    it('falls back to the inherited timeZone when companyId has no entry in the map', () => {
        const result = formatDatesDeep({ companyId: 'unknown', createdAt: date }, 'America/Sao_Paulo', new Map()) as any
        expect(result.createdAt).toBe('2026-01-15T09:00:00-03:00')
    })

    it('treats a record with its own id+timezone as the Company itself, ignoring the map', () => {
        const result = formatDatesDeep(
            { id: 'c1', timezone: 'Asia/Tokyo', createdAt: date },
            'America/Sao_Paulo',
            new Map([['c1', 'America/Sao_Paulo']]),
        ) as any
        expect(result.createdAt).toBe('2026-01-15T21:00:00+09:00')
    })

    it('scopes each item of a mixed-company list independently', () => {
        const tzByCompanyId = new Map([['c1', 'America/Sao_Paulo'], ['c2', 'Asia/Tokyo']])
        const result = formatDatesDeep(
            { records: [{ companyId: 'c1', createdAt: date }, { companyId: 'c2', createdAt: date }] },
            'UTC',
            tzByCompanyId,
        ) as any
        expect(result.records[0].createdAt).toBe('2026-01-15T09:00:00-03:00')
        expect(result.records[1].createdAt).toBe('2026-01-15T21:00:00+09:00')
    })
})
