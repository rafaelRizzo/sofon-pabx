import { describe, it, expect } from 'bun:test'
import { buildDialplan } from '../destinations/ivr.repository'

const baseCfg = {
    name: 'Menu Principal',
    soundPath: '/sounds/ast1/audio1',
    maxDigits: 1,
    digitTimeout: 5,
    invalidRetries: 3,
    timeoutRetries: 3,
    variableName: null as string | null,
}

describe('buildDialplan (IVR)', () => {
    it('menu type (K=2 options): full priority sequence, MULTI_SET is NoOp without variableName', () => {
        const rows = buildDialplan(
            'ivr1',
            baseCfg,
            [
                { digit: '1', target: 'ramais,1001,1' },
                { digit: '2', target: 'queues-app,q-1,1' },
            ],
            'ramais,1002,1', // invalidTarget
            null,             // timeoutTarget
            null,             // longTarget
        )

        const byPriority = new Map(rows.map((r) => [r.priority, r]))
        expect(byPriority.get(1)).toMatchObject({ app: 'NoOp', appdata: 'IVR: Menu Principal' })
        expect(byPriority.get(2)).toMatchObject({ app: 'Set', appdata: '__IVR_INV=0' })
        expect(byPriority.get(3)).toMatchObject({ app: 'Set', appdata: '__IVR_TMO=0' })
        expect(byPriority.get(4)).toMatchObject({ app: 'Read', appdata: 'IVR_DIGITS,/sounds/ast1/audio1,1,,1,5' })
        expect(byPriority.get(5)).toMatchObject({ app: 'GotoIf', appdata: '$["${READSTATUS}"="TIMEOUT"]?15' })
        expect(byPriority.get(6)).toMatchObject({ app: 'GotoIf', appdata: '$[${LEN(${IVR_DIGITS})} > 1]?13' })
        expect(byPriority.get(7)).toMatchObject({ app: 'GotoIf', appdata: '$["${IVR_DIGITS}"="1"]?ramais,1001,1' })
        expect(byPriority.get(8)).toMatchObject({ app: 'GotoIf', appdata: '$["${IVR_DIGITS}"="2"]?queues-app,q-1,1' })
        expect(byPriority.get(9)).toMatchObject({ app: 'Set', appdata: '__IVR_INV=$[${__IVR_INV}+1]' })
        expect(byPriority.get(10)).toMatchObject({ app: 'GotoIf', appdata: '$[${__IVR_INV} > 3]?12' })
        expect(byPriority.get(11)).toMatchObject({ app: 'Goto', appdata: '4' })
        expect(byPriority.get(12)).toMatchObject({ app: 'Goto', appdata: 'ramais,1002,1' })
        // MULTI_SET: sem variableName, vira NoOp, mantém a numeração fixa independente do type
        expect(byPriority.get(13)).toMatchObject({ app: 'NoOp', appdata: null })
        expect(byPriority.get(14)).toMatchObject({ app: 'Goto', appdata: '9' }) // sem longTarget, cai no invalid loop
        expect(byPriority.get(15)).toMatchObject({ app: 'Set', appdata: '__IVR_TMO=$[${__IVR_TMO}+1]' })
        expect(byPriority.get(16)).toMatchObject({ app: 'GotoIf', appdata: '$[${__IVR_TMO} > 3]?18' })
        expect(byPriority.get(17)).toMatchObject({ app: 'Goto', appdata: '4' })
        expect(byPriority.get(18)).toMatchObject({ app: 'Hangup', appdata: null }) // sem timeoutTarget
        expect(byPriority.get(19)).toMatchObject({ app: 'Hangup', appdata: null })
    })

    it('digit option without target hangs up (K=1)', () => {
        const rows = buildDialplan('ivr2', baseCfg, [{ digit: '9', target: null }], null, null, null)
        const byPriority = new Map(rows.map((r) => [r.priority, r]))
        // DIGITS_START=7, K=1 -> INVALID_INCR=8 -> HANGUP=8+10=18
        expect(byPriority.get(7)).toMatchObject({ appdata: '$["${IVR_DIGITS}"="9"]?18' })
    })

    it('collect type (K=0, variableName set): MULTI_SET copia IVR_DIGITS antes do Goto pro longTarget', () => {
        const rows = buildDialplan(
            'ivr3',
            { ...baseCfg, maxDigits: 11, variableName: 'CPF_CLIENTE' },
            [],
            null,
            null,
            'variable-conditions,varcond-vc1,1', // longTarget
        )

        const byPriority = new Map(rows.map((r) => [r.priority, r]))
        // K=0 -> DIGITS_START=7=INVALID_INCR -> MULTI_SET=11, MULTI_GOTO=12
        expect(byPriority.get(6)).toMatchObject({ app: 'GotoIf', appdata: '$[${LEN(${IVR_DIGITS})} > 1]?11' })
        expect(byPriority.get(11)).toMatchObject({ app: 'Set', appdata: 'CPF_CLIENTE=${IVR_DIGITS}' })
        expect(byPriority.get(12)).toMatchObject({ app: 'Goto', appdata: 'variable-conditions,varcond-vc1,1' })
    })

    it('collect type without variableName: MULTI_SET is a no-op, still routes to longTarget', () => {
        const rows = buildDialplan(
            'ivr4',
            { ...baseCfg, maxDigits: 11 },
            [],
            null,
            null,
            'ramais,1003,1',
        )
        const byPriority = new Map(rows.map((r) => [r.priority, r]))
        expect(byPriority.get(11)).toMatchObject({ app: 'NoOp', appdata: null })
        expect(byPriority.get(12)).toMatchObject({ app: 'Goto', appdata: 'ramais,1003,1' })
    })
})
