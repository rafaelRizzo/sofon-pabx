import { describe, expect, it } from 'bun:test'
import { applyMask } from '../format-mask'

describe('applyMask', () => {
    it('aplica a máscara de CPF quando o valor limpo tem 11 dígitos', () => {
        const result = applyMask('12312312312', ['000.000.000-00', '00.000.000/0000-00'])
        expect(result).toEqual({ matched: '000.000.000-00', output: '123.123.123-12' })
    })

    it('aplica a máscara de CNPJ quando o valor limpo tem 14 dígitos', () => {
        const result = applyMask('12345678000199', ['000.000.000-00', '00.000.000/0000-00'])
        expect(result).toEqual({ matched: '00.000.000/0000-00', output: '12.345.678/0001-99' })
    })

    it('ignora pontuação já existente no valor de entrada antes de aplicar a máscara', () => {
        const result = applyMask('123.123.123-12', ['000.000.000-00'])
        expect(result?.output).toBe('123.123.123-12')
    })

    it('retorna null quando nenhuma máscara bate com o tamanho do valor', () => {
        expect(applyMask('123', ['000.000.000-00', '00.000.000/0000-00'])).toBeNull()
    })

    it('retorna null quando a classe do caractere não bate (letra onde a máscara exige dígito)', () => {
        expect(applyMask('1231231231A', ['000.000.000-00'])).toBeNull()
    })

    it('aplica máscara alfanumérica de placa (letras + dígitos, mistura de tokens)', () => {
        const result = applyMask('abc1d23', ['AAA0A00'])
        expect(result).toEqual({ matched: 'AAA0A00', output: 'abc1d23' })
    })

    it('literal da máscara não consome caractere do valor de entrada', () => {
        const result = applyMask('12345', ['00-00-0'])
        expect(result).toEqual({ matched: '00-00-0', output: '12-34-5' })
    })

    it('testa as máscaras na ordem informada e usa a primeira compatível', () => {
        // ambas têm 4 tokens consumidores - a primeira da lista tem prioridade
        const result = applyMask('1234', ['00-00', '0000'])
        expect(result).toEqual({ matched: '00-00', output: '12-34' })
    })
})
