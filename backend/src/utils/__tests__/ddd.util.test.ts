import { describe, it, expect } from 'bun:test'
import { extractDDD, DDD_TO_UF } from '../ddd.util'

describe('extractDDD', () => {
    it('extracts DDD from an 11-digit mobile number', () => {
        expect(extractDDD('11987654321')).toBe('11')
    })

    it('extracts DDD from a 10-digit landline number', () => {
        expect(extractDDD('2134567890')).toBe('21')
    })

    it('strips the 55 country code before extracting', () => {
        expect(extractDDD('5511987654321')).toBe('11')
        expect(extractDDD('552134567890')).toBe('21')
    })

    it('strips non-digit characters first', () => {
        expect(extractDDD('+55 (11) 98765-4321')).toBe('11')
    })

    it('returns null for an internal extension (short number)', () => {
        expect(extractDDD('2002')).toBeNull()
    })

    it('returns null for a special/utility number (no real DDD)', () => {
        expect(extractDDD('0800123456')).toBeNull() // "08" não é DDD válido
        expect(extractDDD('190')).toBeNull()
    })

    it('returns null for null/undefined/empty input', () => {
        expect(extractDDD(null)).toBeNull()
        expect(extractDDD(undefined)).toBeNull()
        expect(extractDDD('')).toBeNull()
    })

    it('maps every DDD to a valid 2-letter UF', () => {
        for (const uf of Object.values(DDD_TO_UF)) {
            expect(uf).toMatch(/^[A-Z]{2}$/)
        }
    })
})
