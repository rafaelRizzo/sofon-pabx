import { describe, it, expect } from 'bun:test'
import { parseMemberInterface, toAsteriskInterface, parseAsteriskQueueName } from '../queue.repository'

describe('parseMemberInterface', () => {
    it('parses MEMBERINTERFACE into type/number', () => {
        expect(parseMemberInterface('PJSIP/2002_ast1')).toEqual({ type: 'pjsip', number: '2002_ast1' })
        expect(parseMemberInterface('SIP/2001_ast1')).toEqual({ type: 'sip', number: '2001_ast1' })
    })

    it('returns null when there is no type/number separator', () => {
        expect(parseMemberInterface('garbage')).toBeNull()
    })

    it('round-trips with toAsteriskInterface', () => {
        const iface = toAsteriskInterface('pjsip', '2002_ast1')
        expect(parseMemberInterface(iface)).toEqual({ type: 'pjsip', number: '2002_ast1' })
    })
})

describe('parseAsteriskQueueName', () => {
    it('parses <asteriskId>-<number> using the fixed 10-char asteriskId length', () => {
        expect(parseAsteriskQueueName('a9e2463c8f-600')).toEqual({ asteriskId: 'a9e2463c8f', queueNumber: '600' })
    })

    it('returns null when there is no separator at position 10', () => {
        expect(parseAsteriskQueueName('too-short')).toBeNull()
        expect(parseAsteriskQueueName('a9e2463c8f600')).toBeNull()
    })
})
