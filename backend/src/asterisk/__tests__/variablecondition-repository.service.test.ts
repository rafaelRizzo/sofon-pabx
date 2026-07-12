import { describe, it, expect } from 'bun:test'
import { buildExpr, buildDialplan } from '../variablecondition.repository'

describe('buildExpr', () => {
    it('filled/empty check quoted equality against empty string', () => {
        expect(buildExpr({ variable: 'MYVAR', operator: 'filled' })).toBe('"${MYVAR}" != ""')
        expect(buildExpr({ variable: 'MYVAR', operator: 'empty' })).toBe('"${MYVAR}" = ""')
    })

    it('length operators wrap the variable in LEN()', () => {
        expect(buildExpr({ variable: 'CPF', operator: 'length_eq', value: '11' })).toBe('${LEN(${CPF})} = 11')
        expect(buildExpr({ variable: 'CPF', operator: 'length_gte', value: '11' })).toBe('${LEN(${CPF})} >= 11')
        expect(buildExpr({ variable: 'CPF', operator: 'length_lt', value: '5' })).toBe('${LEN(${CPF})} < 5')
    })

    it('eq/neq compare quoted string values', () => {
        expect(buildExpr({ variable: 'STATUS', operator: 'eq', value: 'ok' })).toBe('"${STATUS}" = "ok"')
        expect(buildExpr({ variable: 'STATUS', operator: 'neq', value: 'ok' })).toBe('"${STATUS}" != "ok"')
    })

    it('numeric operators compare raw (unquoted) values', () => {
        expect(buildExpr({ variable: 'AGE', operator: 'gte', value: '18' })).toBe('${AGE} >= 18')
        expect(buildExpr({ variable: 'AGE', operator: 'lt', value: '65' })).toBe('${AGE} < 65')
    })

    it('regex uses REGEX() verbatim', () => {
        expect(buildExpr({ variable: 'EMAIL', operator: 'regex', value: '^[a-z]+@[a-z]+$' }))
            .toBe('${REGEX("^[a-z]+@[a-z]+$",${EMAIL})} = 1')
    })

    it('contains escapes regex metacharacters in the literal substring', () => {
        expect(buildExpr({ variable: 'URL', operator: 'contains', value: 'a.b(c)' }))
            .toBe('${REGEX("a\\.b\\(c\\)",${URL})} = 1')
    })

    it('supports function-call variables like CALLERID(num)', () => {
        expect(buildExpr({ variable: 'CALLERID(num)', operator: 'filled' })).toBe('"${CALLERID(num)}" != ""')
    })
})

describe('buildDialplan', () => {
    it('or combinator: each rule GotoIf jumps to -matched, falls through to falseRoute', () => {
        const rows = buildDialplan('c1', 'Tem CPF valido', 'or', [
            { variable: 'CPF', operator: 'filled' },
        ], 'ramais,1001,1', 'ramais,1002,1')

        expect(rows[0]).toMatchObject({ exten: 'varcond-c1', priority: 1, app: 'NoOp' })
        expect(rows[1]).toMatchObject({ exten: 'varcond-c1', priority: 2, app: 'GotoIf', appdata: '$["${CPF}" != ""]?varcond-c1-matched,1' })
        expect(rows[2]).toMatchObject({ exten: 'varcond-c1', priority: 3, app: 'Goto', appdata: 'ramais,1002,1' })
        expect(rows[3]).toMatchObject({ exten: 'varcond-c1-matched', priority: 1, app: 'Goto', appdata: 'ramais,1001,1' })
    })

    it('and combinator: each rule GotoIf jumps to -fail on false, falls through to trueRoute', () => {
        const rows = buildDialplan('c2', 'CPF valido e preenchido', 'and', [
            { variable: 'CPF', operator: 'filled' },
            { variable: 'CPF', operator: 'length_eq', value: '11' },
        ], 'ramais,1001,1', 'ramais,1002,1')

        expect(rows[0]).toMatchObject({ exten: 'varcond-c2', priority: 1, app: 'NoOp' })
        expect(rows[1]).toMatchObject({ exten: 'varcond-c2', priority: 2, app: 'GotoIf', appdata: '$["${CPF}" != ""]?:varcond-c2-fail,1' })
        expect(rows[2]).toMatchObject({ exten: 'varcond-c2', priority: 3, app: 'GotoIf', appdata: '$[${LEN(${CPF})} = 11]?:varcond-c2-fail,1' })
        expect(rows[3]).toMatchObject({ exten: 'varcond-c2', priority: 4, app: 'Goto', appdata: 'ramais,1001,1' })
        expect(rows[4]).toMatchObject({ exten: 'varcond-c2-fail', priority: 1, app: 'Goto', appdata: 'ramais,1002,1' })
    })

    it('hangs up when a route is not configured', () => {
        const rows = buildDialplan('c3', 'sem rotas', 'or', [{ variable: 'X', operator: 'filled' }], null, null)
        expect(rows.find((r) => r.exten === 'varcond-c3-matched')).toMatchObject({ app: 'Hangup', appdata: null })
        expect(rows.find((r) => r.app === 'Goto' && r.exten === 'varcond-c3')).toBeUndefined()
        expect(rows.find((r) => r.exten === 'varcond-c3' && r.priority === 3)).toMatchObject({ app: 'Hangup', appdata: null })
    })
})
