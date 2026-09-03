import { describe, it, expect } from 'bun:test'
import { extractTableRows } from '../sql-dump.parser'

describe('extractTableRows', () => {
    it('parses multiple tuples on a single INSERT line', () => {
        const sql = "INSERT INTO `devices` (`id`,`tech`) VALUES ('2001','sip'),('2002','sip'),('2003','sip');"
        expect(extractTableRows(sql, 'devices')).toEqual([
            ['2001', 'sip'],
            ['2002', 'sip'],
            ['2003', 'sip'],
        ])
    })

    it('merges rows from multiple INSERT statements for the same table', () => {
        const sql = [
            "INSERT INTO `devices` (`id`,`tech`) VALUES ('2001','sip');",
            "INSERT INTO `devices` (`id`,`tech`) VALUES ('2002','sip');",
        ].join('\n')
        expect(extractTableRows(sql, 'devices')).toEqual([
            ['2001', 'sip'],
            ['2002', 'sip'],
        ])
    })

    it('unescapes backslash-escaped single quotes inside a value', () => {
        const sql = "INSERT INTO `devices` (`id`,`description`) VALUES ('2001','João\\'s desk');"
        expect(extractTableRows(sql, 'devices')).toEqual([['2001', "João's desk"]])
    })

    it('turns a bare NULL literal into null', () => {
        const sql = "INSERT INTO `devices` (`id`,`description`) VALUES ('2001',NULL);"
        expect(extractTableRows(sql, 'devices')).toEqual([['2001', null]])
    })

    it('keeps an empty quoted string as empty string, not null', () => {
        const sql = "INSERT INTO `devices` (`id`,`description`) VALUES ('2001','');"
        const rows = extractTableRows(sql, 'devices')
        expect(rows[0]?.[1]).toBe('')
        expect(rows[0]?.[1]).not.toBeNull()
    })

    it('keeps an unquoted numeric field as its raw string representation', () => {
        const sql = "INSERT INTO `x` (`a`,`b`) VALUES (5,'test');"
        expect(extractTableRows(sql, 'x')).toEqual([['5', 'test']])
    })

    it('returns an empty array when the table has no INSERT statements', () => {
        const sql = "INSERT INTO `other` (`id`) VALUES ('1');"
        expect(extractTableRows(sql, 'devices')).toEqual([])
    })
})
