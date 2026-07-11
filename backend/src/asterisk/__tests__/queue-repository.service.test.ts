import { describe, it, expect } from 'bun:test'
import { parseMemberInterface, toAsteriskInterface } from '../queue.repository'

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
