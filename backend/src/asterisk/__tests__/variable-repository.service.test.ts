import { describe, it, expect } from 'bun:test'
import { buildDialplan } from '../variable.repository'

describe('buildDialplan', () => {
    it('emits one Set per assignment, then Goto to the destination', () => {
        const rows = buildDialplan('v1', 'Seta CRM', [
            { variable: 'CRM_ID', value: '123' },
            { variable: 'CRM_TIER', value: '${OUTRAVAR}-gold' },
        ], 'ramais,1001,1')

        expect(rows).toEqual([
            { context: 'variables', exten: 'var-v1', priority: 1, app: 'NoOp', appdata: 'VariableSet: Seta CRM' },
            { context: 'variables', exten: 'var-v1', priority: 2, app: 'Set', appdata: 'CRM_ID=123' },
            { context: 'variables', exten: 'var-v1', priority: 3, app: 'Set', appdata: 'CRM_TIER=${OUTRAVAR}-gold' },
            { context: 'variables', exten: 'var-v1', priority: 4, app: 'Goto', appdata: 'ramais,1001,1' },
        ])
    })

    it('hangs up when there is no destination', () => {
        const rows = buildDialplan('v2', 'Sem destino', [{ variable: 'X', value: '1' }], null)
        expect(rows.at(-1)).toMatchObject({ app: 'Hangup', appdata: null })
    })

    it('does not materialize unsafe legacy interpolations', () => {
        const rows = buildDialplan('v3', 'Legado', [{ variable: 'X', value: '${SHELL(id)}' }], null)
        expect(rows[1]).toMatchObject({ app: 'Set', appdata: 'X=' })
    })
})
