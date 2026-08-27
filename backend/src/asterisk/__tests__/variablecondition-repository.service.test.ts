import { describe, it, expect } from 'bun:test'
import { evaluateRule, evaluateRules } from '../destinations/variablecondition.repository'

describe('evaluateRule', () => {
    it('filled/empty check the real value against empty string', () => {
        expect(evaluateRule('123', { variable: 'MYVAR', operator: 'filled' })).toBe(true)
        expect(evaluateRule('', { variable: 'MYVAR', operator: 'filled' })).toBe(false)
        expect(evaluateRule('', { variable: 'MYVAR', operator: 'empty' })).toBe(true)
        expect(evaluateRule('123', { variable: 'MYVAR', operator: 'empty' })).toBe(false)
    })

    it('length operators compare value.length', () => {
        expect(evaluateRule('12345678901', { variable: 'CPF', operator: 'length_eq', value: '11' })).toBe(true)
        expect(evaluateRule('123', { variable: 'CPF', operator: 'length_gte', value: '11' })).toBe(false)
        expect(evaluateRule('123', { variable: 'CPF', operator: 'length_lt', value: '5' })).toBe(true)
    })

    it('eq/neq compare the raw string value', () => {
        expect(evaluateRule('ok', { variable: 'STATUS', operator: 'eq', value: 'ok' })).toBe(true)
        expect(evaluateRule('fail', { variable: 'STATUS', operator: 'eq', value: 'ok' })).toBe(false)
        expect(evaluateRule('fail', { variable: 'STATUS', operator: 'neq', value: 'ok' })).toBe(true)
    })

    it('numeric operators compare Number(value)', () => {
        expect(evaluateRule('20', { variable: 'AGE', operator: 'gte', value: '18' })).toBe(true)
        expect(evaluateRule('70', { variable: 'AGE', operator: 'lt', value: '65' })).toBe(false)
    })

    it('contains checks a literal substring (no regex escaping needed anymore)', () => {
        expect(evaluateRule('https://a.b(c)/x', { variable: 'URL', operator: 'contains', value: 'a.b(c)' })).toBe(true)
        expect(evaluateRule('https://x.y/z', { variable: 'URL', operator: 'contains', value: 'a.b(c)' })).toBe(false)
    })

    it('regex applies the configured pattern and never throws on an invalid one', () => {
        expect(evaluateRule('a@b.com', { variable: 'EMAIL', operator: 'regex', value: '^[a-z]+@[a-z]+\\.[a-z]+$' })).toBe(true)
        expect(evaluateRule('nope', { variable: 'EMAIL', operator: 'regex', value: '^[a-z]+@[a-z]+\\.[a-z]+$' })).toBe(false)
        expect(evaluateRule('x', { variable: 'EMAIL', operator: 'regex', value: '(' })).toBe(false)
    })

    it('works with function-call variables like CALLERID(num) - the rule just carries the name, value comes from the AGI GET VARIABLE call', () => {
        expect(evaluateRule('5511999998888', { variable: 'CALLERID(num)', operator: 'filled' })).toBe(true)
    })

    it('does not break when the live value contains quotes/parens (root cause of the old $[...] syntax error bug)', () => {
        const evilValue = '") | (1=1'
        expect(evaluateRule(evilValue, { variable: 'CALLERID(name)', operator: 'eq', value: 'x' })).toBe(false)
        expect(evaluateRule(evilValue, { variable: 'CALLERID(name)', operator: 'contains', value: '1=1' })).toBe(true)
    })

    it('cpf: rejects wrong length instead of throwing/erroring on an out-of-range slice', () => {
        expect(evaluateRule('123123123112', { variable: 'CPF', operator: 'cpf' })).toBe(false) // 12 dígitos, não 11
        expect(evaluateRule('123', { variable: 'CPF', operator: 'cpf' })).toBe(false)
    })

    it('cpf: excludes the 10 repeated-digit sequences even though the checksum math would pass', () => {
        expect(evaluateRule('00000000000', { variable: 'CPF', operator: 'cpf' })).toBe(false)
        expect(evaluateRule('11111111111', { variable: 'CPF', operator: 'cpf' })).toBe(false)
    })

    it('cpf/cnpj: validates known-good documents and rejects a tampered digit', () => {
        expect(evaluateRule('52998224725', { variable: 'CPF', operator: 'cpf' })).toBe(true)
        expect(evaluateRule('52998224726', { variable: 'CPF', operator: 'cpf' })).toBe(false)
        expect(evaluateRule('11222333000181', { variable: 'CNPJ', operator: 'cnpj' })).toBe(true)
        expect(evaluateRule('11222333000182', { variable: 'CNPJ', operator: 'cnpj' })).toBe(false)
    })

    it('cnpj alfanumérico (IN RFB 2.229/2024): aceita letra na raiz, dígito verificador via code(char)-48', () => {
        const charValue = (c: string) => c.charCodeAt(0) - 48
        const verifierDigit = (values: number[], weights: number[]) => {
            const sum = values.reduce((acc, v, i) => acc + v * weights[i]!, 0)
            return ((sum * 10) % 11) % 10
        }
        const base = '12ABC34501DE' // 12 caracteres, mistura dígito e letra
        const baseValues = [...base].map(charValue)
        const dv1 = verifierDigit(baseValues, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
        const dv2 = verifierDigit([...baseValues, dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
        const cnpj = `${base}${dv1}${dv2}`

        expect(evaluateRule(cnpj, { variable: 'CNPJ', operator: 'cnpj' })).toBe(true)
        const tampered = `${cnpj.slice(0, -1)}${cnpj.endsWith('9') ? '0' : '9'}`
        expect(evaluateRule(tampered, { variable: 'CNPJ', operator: 'cnpj' })).toBe(false)
    })

    it('cpf never accepts a letter in the base, even though the CNPJ spec now does', () => {
        const withLetter = 'A2998224725'
        expect(evaluateRule(withLetter, { variable: 'CPF', operator: 'cpf' })).toBe(false)
    })

    it('cpf/cnpj checksum formula ((soma*10)%11)%10 matches the official rem<2?0:11-rem rule for every possible remainder', () => {
        const officialRule = (rem: number) => (rem < 2 ? 0 : 11 - rem)
        const trickFormula = (rem: number) => ((rem * 10) % 11) % 10
        for (let rem = 0; rem <= 10; rem++) {
            expect(trickFormula(rem)).toBe(officialRule(rem))
        }
    })
})

describe('evaluateRules', () => {
    it('or: true if any result is true', () => {
        expect(evaluateRules('or', [false, false, true])).toBe(true)
        expect(evaluateRules('or', [false, false])).toBe(false)
    })

    it('and: true only if every result is true', () => {
        expect(evaluateRules('and', [true, true])).toBe(true)
        expect(evaluateRules('and', [true, false])).toBe(false)
    })
})
