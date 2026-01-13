import type { ApplicationsType } from "../generated/prisma/enums"
import { prisma } from "../lib/prisma"
import { AppError } from "./handler.error"

// Aplicações que NÃO requerem validação de destinationId
const appsWithoutDestination: ApplicationsType[] = [
    'HANGUP',
    // Adicione outras aplicações que não precisam de destinationId
]

// Mapeamento entre ApplicationsType e os modelos do Prisma
const destinationModels: Partial<Record<ApplicationsType, string>> = {
    ANNOUNCEMENT: 'announcement',
    // CHAT: 'chat',
    // QUEUE: 'queue',
    // USER: 'user',
    // TICKET: 'ticket',
    // Adicione outros mapeamentos conforme necessário
}

export const checkDestinationId = async (
    destinationApp: ApplicationsType,
    destinationId: string
): Promise<void> => {
    // Se a aplicação não precisa de destinationId, retorna sem validar
    if (appsWithoutDestination.includes(destinationApp)) {
        return
    }

    const modelName = destinationModels[destinationApp]

    // Se o tipo de aplicação não está mapeado, lança erro
    if (!modelName) {
        throw new AppError('Tipo de aplicação de destino não suportado', 400)
    }

    try {
        // Acessa dinamicamente o modelo do Prisma
        // @ts-ignore - Prisma tem tipagem dinâmica complexa que dificulta o tipo exato
        const record = await prisma[modelName].findUnique({
            where: { id: destinationId },
            select: { id: true } // Otimização: busca apenas o campo id
        })

        if (!record) {
            throw new AppError('Destino inválido', 400)
        }
    } catch (error) {
        // Se for AppError, propaga o erro original
        if (error instanceof AppError) {
            throw error
        }
        // Outros erros (query error, etc) também são considerados destino inválido
        console.error(`Erro ao verificar destinationId para ${destinationApp}:`, error)
        throw new AppError('Destino inválido', 400)
    }
}