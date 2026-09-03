import { describe, it, expect } from 'bun:test'
import { mapExtensions, mapTrunks, mapQueues } from '../issabel.mapper'
import type { ParsedIssabelDump } from '../issabel.parser'

const COMPANY_ID = 'c1'

const emptyDump = (): ParsedIssabelDump => ({
    devices: [],
    usersByExtension: new Map(),
    sip: new Map(),
    iax: new Map(),
    queuesConfig: [],
    queueDetailsByExtension: new Map(),
    trunks: [],
})

// ─── mapExtensions ──────────────────────────────────────────────────────────
describe('mapExtensions', () => {
    it('skips a device whose tech is not sip', () => {
        const dump = emptyDump()
        dump.devices.push({ id: '2001', tech: 'dahdi', description: 'x' })
        const { extensions, skipped } = mapExtensions(dump, COMPANY_ID)
        expect(extensions).toEqual([])
        expect(skipped[0]).toContain('tecnologia "dahdi"')
    })

    it('skips a device whose alias is not 2-6 digits', () => {
        const dump = emptyDump()
        dump.devices.push({ id: '9999999', tech: 'sip', description: 'x' })
        const { extensions, skipped } = mapExtensions(dump, COMPANY_ID)
        expect(extensions).toEqual([])
        expect(skipped[0]).toContain('fora do padrão aceito')
    })

    it('names the extension from users.name, falling back to device.description then to the id', () => {
        const dump = emptyDump()
        dump.devices.push(
            { id: '2001', tech: 'sip', description: 'Descrição do device' },
            { id: '2002', tech: 'sip', description: 'Só descrição' },
            { id: '2003', tech: 'sip', description: null },
        )
        dump.usersByExtension.set('2001', { extension: '2001', name: 'João Ramal' })

        const { extensions } = mapExtensions(dump, COMPANY_ID)
        expect(extensions.map((e) => e.input.name)).toEqual(['João Ramal', 'Só descrição', '2003'])
    })

    it('maps chan_sip allow codecs from & to comma-separated', () => {
        const dump = emptyDump()
        dump.devices.push({ id: '2001', tech: 'sip', description: 'x' })
        dump.sip.set('2001', new Map([['allow', 'ulaw&alaw&g729']]))

        const { extensions } = mapExtensions(dump, COMPANY_ID)
        expect(extensions[0]?.input).toMatchObject({ alias: '2001', companyId: COMPANY_ID, type: 'sip', allow: 'ulaw,alaw,g729' })
        expect(extensions[0]?.issabelId).toBe('2001')
    })
})

// ─── mapTrunks ──────────────────────────────────────────────────────────────
describe('mapTrunks', () => {
    it('skips a trunk with tech=custom', () => {
        const dump = emptyDump()
        dump.trunks.push({ trunkid: '3', name: 'Tronco Custom', tech: 'custom' })
        const { trunks, skipped } = mapTrunks(dump, COMPANY_ID)
        expect(trunks).toEqual([])
        expect(skipped[0]).toContain('tecnologia "custom"')
    })

    it('skips a trunk with no matching peer entry in the dump', () => {
        const dump = emptyDump()
        dump.trunks.push({ trunkid: '4', name: 'Sem Peer', tech: 'sip' })
        const { trunks, skipped } = mapTrunks(dump, COMPANY_ID)
        expect(trunks).toEqual([])
        expect(skipped[0]).toContain('sem configuração de peer')
    })

    it('maps host=dynamic to username/password, without a host field', () => {
        const dump = emptyDump()
        dump.trunks.push({ trunkid: '1', name: 'Tronco Dinamico', tech: 'sip' })
        dump.sip.set('tr-peer-1', new Map([['host', 'dynamic'], ['username', 'u1'], ['secret', 's1'], ['allow', 'ulaw&alaw']]))

        const { trunks } = mapTrunks(dump, COMPANY_ID)
        expect(trunks).toHaveLength(1)
        expect(trunks[0]?.input).toMatchObject({
            companyId: COMPANY_ID,
            type: 'pjsip',
            registrationMode: 'inbound',
            codecs: 'ulaw,alaw',
            username: 'u1',
            password: 's1',
        })
        expect(trunks[0]?.input).not.toHaveProperty('host')
    })

    it('maps a fixed host to a host field, without username/password', () => {
        const dump = emptyDump()
        dump.trunks.push({ trunkid: '2', name: 'Tronco Fixo', tech: 'sip' })
        dump.sip.set('tr-peer-2', new Map([['host', '1.2.3.4'], ['allow', 'ulaw']]))

        const { trunks } = mapTrunks(dump, COMPANY_ID)
        expect(trunks[0]?.input).toMatchObject({ host: '1.2.3.4', codecs: 'ulaw' })
        expect(trunks[0]?.input).not.toHaveProperty('username')
        expect(trunks[0]?.input).not.toHaveProperty('password')
    })

    it('gives colliding sanitized trunk names a unique suffix from the trunkid', () => {
        const dump = emptyDump()
        dump.trunks.push(
            { trunkid: '1', name: 'Tronco Principal', tech: 'sip' },
            { trunkid: '5', name: 'Tronco Principal', tech: 'sip' },
        )
        dump.sip.set('tr-peer-1', new Map([['host', 'dynamic'], ['username', 'u1'], ['secret', 's1']]))
        dump.sip.set('tr-peer-5', new Map([['host', 'dynamic'], ['username', 'u5'], ['secret', 's5']]))

        const { trunks } = mapTrunks(dump, COMPANY_ID)
        const names = trunks.map((t) => t.input.name)
        expect(names[0]).toBe('tronco-principal')
        expect(names[1]).toBe('tronco-principal-5')
        expect(new Set(names).size).toBe(2)
    })
})

// ─── mapQueues ──────────────────────────────────────────────────────────────
describe('mapQueues', () => {
    it('skips a queue whose extension is not all digits', () => {
        const dump = emptyDump()
        dump.queuesConfig.push({ extension: 'abc', descr: 'Fila invalida' })
        const { queues, skipped } = mapQueues(dump, COMPANY_ID)
        expect(queues).toEqual([])
        expect(skipped[0]).toContain('fora do padrão aceito')
    })

    it('slugifies a descr with spaces and accents into the queue name', () => {
        const dump = emptyDump()
        dump.queuesConfig.push({ extension: '600', descr: 'Configuração Rápida' })
        const { queues } = mapQueues(dump, COMPANY_ID)
        expect(queues[0]?.input.name).toBe('configuracao-rapida')
        expect(queues[0]?.input.number).toBe('600')
    })

    it('converts joinempty/leavewhenempty yes/no strings into booleans', () => {
        const dump = emptyDump()
        dump.queuesConfig.push({ extension: '600', descr: 'Fila' })
        dump.queueDetailsByExtension.set('600', {
            settings: new Map([['joinempty', 'no'], ['leavewhenempty', 'yes']]),
            members: [],
        })
        const { queues } = mapQueues(dump, COMPANY_ID)
        expect(queues[0]?.input).toMatchObject({ joinEmpty: false, leaveWhenEmpty: true })
    })

    it('carries the parsed queue members through to the mapped result', () => {
        const dump = emptyDump()
        dump.queuesConfig.push({ extension: '600', descr: 'Fila' })
        dump.queueDetailsByExtension.set('600', {
            settings: new Map(),
            members: [{ kind: 'sip', number: '2001', penalty: 3 }],
        })
        const { queues } = mapQueues(dump, COMPANY_ID)
        expect(queues[0]?.members).toEqual([{ kind: 'sip', number: '2001', penalty: 3 }])
        expect(queues[0]?.issabelId).toBe('600')
    })
})
