import type { ApplicationsType, IVROptionType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { checkDestinationId } from '../../utils/handler.destinations'
import { AppError } from '../../utils/handler.error'

type CreateIVROptionType = {
    type: IVROptionType
    digit?: string
    minDigits?: number
    maxDigits?: number
    variableName?: string
    destinationApp: ApplicationsType
    destinationId?: string
    ivrId: string
    companyId: string
}

type UpdateIVROptionType = Partial<CreateIVROptionType>

export const ivrOptionSelect = {
    id: true,
    type: true,
    digit: true,
    minDigits: true,
    maxDigits: true,
    variableName: true,
    destinationApp: true,
    destinationId: true,
    ivrId: true,
    companyId: true,
    createdAt: true,
    updatedAt: true
}

export class IVROptionService {

    async create(data: CreateIVROptionType) {
        // Validação: type=DIGIT exige digit
        if (data.type === 'DIGIT' && !data.digit) {
            throw new AppError('Dígito é obrigatório para opções do tipo DIGIT', 400)
        }

        // Validação: type=INPUT exige variableName
        if (data.type === 'INPUT' && !data.variableName) {
            throw new AppError('Nome da variável é obrigatório para opções do tipo INPUT', 400)
        }

        // Verifica se já existe uma opção com o mesmo dígito para este IVR (apenas para DIGIT)
        if (data.type === 'DIGIT' && data.digit) {
            const existingOption = await prisma.iVROption.findUnique({
                where: {
                    ivrId_digit: {
                        ivrId: data.ivrId,
                        digit: data.digit
                    }
                }
            })

            if (existingOption) {
                throw new AppError('Opção IVR já cadastrada para este dígito', 409)
            }
        }

        // Verifica se já existe uma opção INPUT para este IVR
        if (data.type === 'INPUT') {
            const existingInput = await prisma.iVROption.findFirst({
                where: {
                    ivrId: data.ivrId,
                    type: 'INPUT'
                }
            })

            if (existingInput) {
                throw new AppError('Já existe uma opção INPUT cadastrada para este IVR', 409)
            }
        }

        // Valida o destino
        if (data.destinationId) {
            await checkDestinationId(
                data.destinationApp,
                data.destinationId
            )
        }

        return await prisma.iVROption.create({
            data: {
                type: data.type,
                digit: data.type === 'DIGIT' ? data.digit : null,
                minDigits: data.type === 'INPUT' ? (data.minDigits ?? 1) : null,
                maxDigits: data.type === 'INPUT' ? (data.maxDigits ?? 20) : null,
                variableName: data.type === 'INPUT' ? data.variableName : null,
                destinationApp: data.destinationApp,
                destinationId: data.destinationId,
                ivrId: data.ivrId,
                companyId: data.companyId
            },
            select: ivrOptionSelect
        })
    }

    async list(ivrId?: string, companyId?: string) {
        return await prisma.iVROption.findMany({
            where: {
                ...(ivrId && { ivrId }),
                ...(companyId && { companyId })
            },
            select: ivrOptionSelect,
            orderBy: [
                { type: 'asc' }, // INPUT primeiro, depois DIGIT
                { digit: 'asc' } // Ordena por dígito
            ]
        })
    }

    async getById(id: string) {
        const option = await prisma.iVROption.findUnique({
            where: { id },
            select: ivrOptionSelect
        })

        if (!option) {
            throw new AppError('Opção IVR não encontrada', 404)
        }

        return option
    }

    async update(id: string, data: UpdateIVROptionType) {
        const existingOption = await prisma.iVROption.findUnique({
            where: { id }
        })

        if (!existingOption) {
            throw new AppError('Opção IVR não encontrada', 404)
        }

        const newType = data.type ?? existingOption.type

        // Validação: se mudar para DIGIT, exige digit
        if (newType === 'DIGIT' && !data.digit && !existingOption.digit) {
            throw new AppError('Dígito é obrigatório para opções do tipo DIGIT', 400)
        }

        // Validação: se mudar para INPUT, exige variableName
        if (newType === 'INPUT' && !data.variableName && !existingOption.variableName) {
            throw new AppError('Nome da variável é obrigatório para opções do tipo INPUT', 400)
        }

        // Verifica duplicação de dígito se estiver mudando (apenas para DIGIT)
        if (newType === 'DIGIT' && data.digit && data.digit !== existingOption.digit) {
            const duplicateDigit = await prisma.iVROption.findUnique({
                where: {
                    ivrId_digit: {
                        ivrId: existingOption.ivrId,
                        digit: data.digit
                    }
                }
            })

            if (duplicateDigit) {
                throw new AppError('Opção IVR já cadastrada para este dígito', 409)
            }
        }

        // Verifica se já existe INPUT ao mudar tipo para INPUT
        if (data.type === 'INPUT' && existingOption.type !== 'INPUT') {
            const existingInput = await prisma.iVROption.findFirst({
                where: {
                    ivrId: existingOption.ivrId,
                    type: 'INPUT',
                    id: { not: id }
                }
            })

            if (existingInput) {
                throw new AppError('Já existe uma opção INPUT cadastrada para este IVR', 409)
            }
        }

        // Valida o destino se estiver mudando
        if (data.destinationId) {
            await checkDestinationId(
                data.destinationApp ?? existingOption.destinationApp,
                data.destinationId
            )
        }

        return await prisma.iVROption.update({
            where: { id },
            data: {
                type: data.type,
                digit: newType === 'DIGIT' ? data.digit : null,
                minDigits: newType === 'INPUT' ? data.minDigits : null,
                maxDigits: newType === 'INPUT' ? data.maxDigits : null,
                variableName: newType === 'INPUT' ? data.variableName : null,
                destinationApp: data.destinationApp,
                destinationId: data.destinationId
            },
            select: ivrOptionSelect
        })
    }

    async delete(id: string) {
        const option = await prisma.iVROption.findUnique({
            where: { id }
        })

        if (!option) {
            throw new AppError('Opção IVR não encontrada', 404)
        }

        await prisma.iVROption.delete({
            where: { id }
        })

        return true
    }
}