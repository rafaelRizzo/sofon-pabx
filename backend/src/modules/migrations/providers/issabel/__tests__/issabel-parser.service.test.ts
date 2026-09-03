import { describe, it, expect } from 'bun:test'
import { parseIssabelDump } from '../issabel.parser'

const FIXTURE_SQL = `
INSERT INTO \`devices\` (\`id\`, \`tech\`, \`c3\`, \`c4\`, \`c5\`, \`description\`) VALUES
('2001','sip','x','y','z','Ramal Suporte'),
('2002','sip','x','y','z',NULL);

INSERT INTO \`users\` (\`extension\`, \`c2\`, \`name\`) VALUES
('2001','x','João Ramal');

INSERT INTO \`sip\` (\`id\`, \`keyword\`, \`data\`) VALUES
('2001','allow','ulaw&alaw'),
('2001','secret','pass123'),
('2002','allow','ulaw');

INSERT INTO \`queues_config\` (\`extension\`, \`descr\`) VALUES
('600','Suporte Financeiro');

INSERT INTO \`queues_details\` (\`id\`, \`keyword\`, \`data\`) VALUES
('600','strategy','ringall'),
('600','member','SIP/2003,2'),
('600','member','Agent/97,0'),
('600','member','Local/foo/n@from-queue,0');

INSERT INTO \`trunks\` (\`trunkid\`, \`name\`, \`tech\`) VALUES
('1','tronco-sip','sip');
`

describe('parseIssabelDump', () => {
    it('parses devices as positional rows with description at index 5', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        expect(parsed.devices).toEqual([
            { id: '2001', tech: 'sip', description: 'Ramal Suporte' },
            { id: '2002', tech: 'sip', description: null },
        ])
    })

    it('parses users into a map by extension', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        expect(parsed.usersByExtension.get('2001')).toEqual({ extension: '2001', name: 'João Ramal' })
    })

    it('groups the sip EAV table by id', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        expect(parsed.sip.get('2001')).toEqual(new Map([['allow', 'ulaw&alaw'], ['secret', 'pass123']]))
        expect(parsed.sip.get('2002')).toEqual(new Map([['allow', 'ulaw']]))
    })

    it('parses queues_config', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        expect(parsed.queuesConfig).toEqual([{ extension: '600', descr: 'Suporte Financeiro' }])
    })

    it('splits queues_details into scalar settings and a member array, keeping declaration order', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        const details = parsed.queueDetailsByExtension.get('600')
        expect(details?.settings.get('strategy')).toBe('ringall')
        expect(details?.members).toEqual([
            { kind: 'sip', number: '2003', penalty: 2 },
            { kind: 'agent', number: null, penalty: 0 },
            { kind: 'other', number: null, penalty: 0 },
        ])
    })

    it('parses trunks', () => {
        const parsed = parseIssabelDump(FIXTURE_SQL)
        expect(parsed.trunks).toEqual([{ trunkid: '1', name: 'tronco-sip', tech: 'sip' }])
    })
})
