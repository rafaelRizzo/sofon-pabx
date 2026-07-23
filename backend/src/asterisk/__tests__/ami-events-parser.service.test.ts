import { describe, it, expect } from 'bun:test'
import { extractAmiBlocks, parseAmiBlock } from '../ami-events.parser'

describe('parseAmiBlock', () => {
    it('parses key/value lines into an object', () => {
        expect(parseAmiBlock('Event: PeerStatus\r\nPeer: SIP/2002_ast1\r\nPeerStatus: Registered')).toEqual({
            Event: 'PeerStatus',
            Peer: 'SIP/2002_ast1',
            PeerStatus: 'Registered',
        })
    })

    it('ignores lines without a colon', () => {
        expect(parseAmiBlock('Event: Foo\r\ngarbage\r\nBar: 1')).toEqual({ Event: 'Foo', Bar: '1' })
    })

    it('trims whitespace around key and value', () => {
        expect(parseAmiBlock('Event:  Foo  \r\n  Key  :  value  ')).toEqual({ Event: 'Foo', Key: 'value' })
    })
})

describe('extractAmiBlocks', () => {
    it('extracts a single complete block', () => {
        const { blocks, rest } = extractAmiBlocks('Event: Foo\r\nBar: 1\r\n\r\n')
        expect(blocks).toEqual([{ Event: 'Foo', Bar: '1' }])
        expect(rest).toBe('')
    })

    it('extracts multiple blocks arrived in the same TCP chunk', () => {
        const { blocks, rest } = extractAmiBlocks('Event: Foo\r\n\r\nEvent: Bar\r\n\r\n')
        expect(blocks).toEqual([{ Event: 'Foo' }, { Event: 'Bar' }])
        expect(rest).toBe('')
    })

    it('keeps an incomplete trailing block for the next chunk', () => {
        const { blocks, rest } = extractAmiBlocks('Event: Foo\r\n\r\nEvent: Bar\r\nBaz')
        expect(blocks).toEqual([{ Event: 'Foo' }])
        expect(rest).toBe('Event: Bar\r\nBaz')
    })

    it('round-trips a block split across two chunks', () => {
        const first = extractAmiBlocks('Event: Foo\r\nBar')
        expect(first.blocks).toEqual([])
        expect(first.rest).toBe('Event: Foo\r\nBar')

        const second = extractAmiBlocks(first.rest + ': 1\r\n\r\n')
        expect(second.blocks).toEqual([{ Event: 'Foo', Bar: '1' }])
        expect(second.rest).toBe('')
    })

    it('handles an ActionID-tagged snapshot response block', () => {
        const { blocks } = extractAmiBlocks('Response: Success\r\nActionID: snap-sippeers-1\r\nEventList: start\r\n\r\n')
        expect(blocks).toEqual([{ Response: 'Success', ActionID: 'snap-sippeers-1', EventList: 'start' }])
    })
})
