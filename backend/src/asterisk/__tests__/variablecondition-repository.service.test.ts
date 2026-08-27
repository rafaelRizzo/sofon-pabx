import { describe, it, expect } from 'bun:test'
import { buildExpr, buildDialplan } from '../destinations/variablecondition.repository'

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

    it('cpf: guards LEN/REGEX, excludes the 10 repeated-digit sequences, checks both verifier digits', () => {
        const expr = buildExpr({ variable: 'CPF', operator: 'cpf' })
        expect(expr).toContain('${LEN(${CPF})} = 11')
        expect(expr).toContain('${REGEX("^[0-9]{11}$",${CPF})} = 1')
        expect(expr).toContain('"${CPF}" != "00000000000"')
        expect(expr).toContain('"${CPF}" != "99999999999"')
        expect(expr).toContain('${CPF:0:1}*10')
        expect(expr).toContain('${CPF:8:1}*2')
        expect(expr).toContain('${CPF:9:1} =')
        expect(expr).toContain('${CPF:10:1} =')
        // 1 LEN + 1 REGEX + 10 repeated-digit exclusions + 2 verifier-digit checks
        expect(expr.split(' & ')).toHaveLength(14)
    })

    it('cnpj: guards LEN/REGEX, does NOT exclude repeated-digit sequences, checks both verifier digits', () => {
        const expr = buildExpr({ variable: 'CNPJ', operator: 'cnpj' })
        expect(expr).toContain('${LEN(${CNPJ})} = 14')
        expect(expr).toContain('${REGEX("^[0-9]{14}$",${CNPJ})} = 1')
        expect(expr).not.toContain('00000000000000')
        expect(expr).toContain('${CNPJ:0:1}*5')
        expect(expr).toContain('${CNPJ:11:1}*2')
        expect(expr).toContain('${CNPJ:12:1} =')
        expect(expr).toContain('${CNPJ:13:1} =')
        // 1 LEN + 1 REGEX + 2 verifier-digit checks (sem exclusão de repetidos)
        expect(expr.split(' & ')).toHaveLength(4)
    })

    it('cpf/cnpj checksum formula ((soma*10)%11)%10 matches the official rem<2?0:11-rem rule for every possible remainder', () => {
        const officialRule = (rem: number) => (rem < 2 ? 0 : 11 - rem)
        const trickFormula = (rem: number) => ((rem * 10) % 11) % 10
        for (let rem = 0; rem <= 10; rem++) {
            expect(trickFormula(rem)).toBe(officialRule(rem))
        }
    })

    it('cpf/cnpj checksum formula validates known-good documents and rejects a tampered digit', () => {
        const verifierDigit = (base: number[], weights: number[]) => {
            const sum = base.reduce((acc, d, i) => acc + d * weights[i]!, 0)
            return ((sum * 10) % 11) % 10
        }
        const isValidCpf = (cpf: string) => {
            const d = cpf.split('').map(Number)
            const dv1 = verifierDigit(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
            const dv2 = verifierDigit([...d.slice(0, 9), dv1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
            return d[9] === dv1 && d[10] === dv2
        }
        const isValidCnpj = (cnpj: string) => {
            const d = cnpj.split('').map(Number)
            const dv1 = verifierDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
            const dv2 = verifierDigit([...d.slice(0, 12), dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
            return d[12] === dv1 && d[13] === dv2
        }

        expect(isValidCpf('52998224725')).toBe(true)
        expect(isValidCpf('52998224726')).toBe(false) // último dígito alterado
        expect(isValidCnpj('11222333000181')).toBe(true)
        expect(isValidCnpj('11222333000182')).toBe(false) // último dígito alterado
    })
})

describe('buildDialplan', () => {
    it('or combinator: each rule GotoIf jumps to -matched, falls through to falseRoute - both branches NoOp before the final Goto', () => {
        const rows = buildDialplan('c1', 'Tem CPF valido', 'or', [
            { variable: 'CPF', operator: 'filled' },
        ], 'ramais,1001,1', 'ramais,1002,1')

        expect(rows[0]).toMatchObject({ exten: 'varcond-c1', priority: 1, app: 'NoOp' })
        expect(rows[1]).toMatchObject({ exten: 'varcond-c1', priority: 2, app: 'GotoIf', appdata: '$["${CPF}" != ""]?varcond-c1-matched,1' })
        expect(rows[2]).toMatchObject({ exten: 'varcond-c1', priority: 3, app: 'NoOp', appdata: 'VariableCondition: NOT MATCHED' })
        expect(rows[3]).toMatchObject({ exten: 'varcond-c1', priority: 4, app: 'Goto', appdata: 'ramais,1002,1' })
        expect(rows[4]).toMatchObject({ exten: 'varcond-c1-matched', priority: 1, app: 'NoOp', appdata: 'VariableCondition: MATCHED' })
        expect(rows[5]).toMatchObject({ exten: 'varcond-c1-matched', priority: 2, app: 'Goto', appdata: 'ramais,1001,1' })
    })

    it('and combinator: each rule GotoIf jumps to -matched on false, falls through to trueRoute - both branches NoOp before the final Goto', () => {
        const rows = buildDialplan('c2', 'CPF valido e preenchido', 'and', [
            { variable: 'CPF', operator: 'filled' },
            { variable: 'CPF', operator: 'length_eq', value: '11' },
        ], 'ramais,1001,1', 'ramais,1002,1')

        expect(rows[0]).toMatchObject({ exten: 'varcond-c2', priority: 1, app: 'NoOp' })
        expect(rows[1]).toMatchObject({ exten: 'varcond-c2', priority: 2, app: 'GotoIf', appdata: '$["${CPF}" != ""]?:varcond-c2-matched,1' })
        expect(rows[2]).toMatchObject({ exten: 'varcond-c2', priority: 3, app: 'GotoIf', appdata: '$[${LEN(${CPF})} = 11]?:varcond-c2-matched,1' })
        expect(rows[3]).toMatchObject({ exten: 'varcond-c2', priority: 4, app: 'NoOp', appdata: 'VariableCondition: MATCHED' })
        expect(rows[4]).toMatchObject({ exten: 'varcond-c2', priority: 5, app: 'Goto', appdata: 'ramais,1001,1' })
        expect(rows[5]).toMatchObject({ exten: 'varcond-c2-matched', priority: 1, app: 'NoOp', appdata: 'VariableCondition: NOT MATCHED' })
        expect(rows[6]).toMatchObject({ exten: 'varcond-c2-matched', priority: 2, app: 'Goto', appdata: 'ramais,1002,1' })
    })

    it('hangs up when a route is not configured', () => {
        const rows = buildDialplan('c3', 'sem rotas', 'or', [{ variable: 'X', operator: 'filled' }], null, null)
        expect(rows.find((r) => r.exten === 'varcond-c3-matched' && r.priority === 2)).toMatchObject({ app: 'Hangup', appdata: null })
        expect(rows.find((r) => r.app === 'Goto' && r.exten === 'varcond-c3')).toBeUndefined()
        expect(rows.find((r) => r.exten === 'varcond-c3' && r.priority === 4)).toMatchObject({ app: 'Hangup', appdata: null })
    })
})
