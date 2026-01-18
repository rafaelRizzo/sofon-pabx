import type { ExtensionType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/handler.error'

type ExtensionDataType = {
    name: string
    alias: string // Identificador que pode repetir entre empresas (ex: "1000", "ramal_vendas")
    companyId: string
    callerIdName: string
    callerIdNum: string // Número real único GLOBALMENTE (não pode repetir)
    typeExtension: ExtensionType
    config: object
    description?: string
}

type UpdateExtensionType = Partial<ExtensionDataType>

// Campos permitidos no config (whitelist)
const ALLOWED_CONFIG_FIELDS = [
    'secret',
    'context',
    'host',
    'type',
    'qualify',
    'nat',
    'canreinvite',
    'insecure',
    'port',
    'dtmfmode',
    'codec',
    'allow',
    'disallow',
    'directmedia',
    'transport',
    'encryption',
    'avpf',
    'icesupport',
    'callerid',
    'accountcode',
    'amaflags',
    'callgroup',
    'pickupgroup',
    'mailbox',
    'deny',
    'permit',
    'md5secret',
    'sendrpid',
    'trustrpid',
    'progressinband',
    'promiscredir',
    'useclientcode'
] as const

export const extensionSelect = {
    id: true,
    name: true,
    alias: true,
    companyId: true,
    callerIdName: true,
    callerIdNum: true,
    description: true,
    typeExtension: true,
    config: true,
    createdAt: true,
    updatedAt: true
}

/**
 * Valida e sanitiza o objeto config
 * Remove campos não permitidos e valida tipos
 */
function validateAndSanitizeConfig(config: any): object {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new AppError('Config deve ser um objeto válido', 400)
    }

    // Remove campos não permitidos (whitelist)
    const sanitizedConfig: any = {}

    for (const key of Object.keys(config)) {
        if (!ALLOWED_CONFIG_FIELDS.includes(key as any)) {
            throw new AppError(`Campo '${key}' não é permitido no config`, 400)
        }

        const value = config[key]

        // Valida que valores sejam strings, numbers ou booleans (não aceita objetos aninhados)
        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            value !== null
        ) {
            throw new AppError(`Valor do campo '${key}' deve ser string, número, booleano ou null`, 400)
        }

        // Sanitiza strings para evitar injection
        if (typeof value === 'string') {
            // Remove caracteres perigosos
            const sanitized = value
                .replace(/[<>]/g, '') // Remove < e >
                .replace(/\${.*?}/g, '') // Remove template strings ${...}
                .replace(/`/g, '') // Remove backticks
                .trim()

            // Limita tamanho de strings
            if (sanitized.length > 500) {
                throw new AppError(`Valor do campo '${key}' excede o tamanho máximo (500 caracteres)`, 400)
            }

            sanitizedConfig[key] = sanitized
        } else {
            sanitizedConfig[key] = value
        }
    }

    // Valida tamanho total do JSON (previne payload muito grande)
    const jsonSize = JSON.stringify(sanitizedConfig).length
    if (jsonSize > 10000) { // 10KB
        throw new AppError('Config excede o tamanho máximo permitido (10KB)', 400)
    }

    return sanitizedConfig
}

export class ExtensionService {

    async create(extension: ExtensionDataType) {
        // Verifica se a empresa existe
        const companyExists = await prisma.company.findUnique({
            where: { id: extension.companyId }
        })

        if (!companyExists) {
            throw new AppError('Empresa não encontrada', 404)
        }

        // Verifica se já existe uma extensão com o mesmo alias nesta empresa
        const existingExtensionByAlias = await prisma.extension.findUnique({
            where: {
                companyId_alias: {
                    companyId: extension.companyId,
                    alias: extension.alias
                }
            }
        })

        if (existingExtensionByAlias) {
            throw new AppError('Já existe uma extensão com este alias para esta empresa', 409)
        }

        // Verifica se já existe uma extensão com o mesmo callerIdNum (único globalmente)
        const existingExtensionByNum = await prisma.extension.findUnique({
            where: {
                callerIdNum: extension.callerIdNum
            }
        })

        if (existingExtensionByNum) {
            throw new AppError('Ramal já cadastrado com este número (callerIdNum deve ser único globalmente)', 409)
        }

        // Valida e sanitiza o config antes de salvar
        const sanitizedConfig = validateAndSanitizeConfig(extension.config)

        const extensionCreated = await prisma.extension.create({
            data: {
                name: extension.name,
                alias: extension.alias,
                companyId: extension.companyId,
                callerIdName: extension.callerIdName,
                callerIdNum: extension.callerIdNum,
                typeExtension: extension.typeExtension,
                config: sanitizedConfig,
                description: extension.description
            },
            select: extensionSelect
        })

        return extensionCreated
    }

    async list(companyId?: string) {
        return await prisma.extension.findMany({
            where: companyId ? { companyId } : undefined,
            select: extensionSelect,
            orderBy: {
                createdAt: 'desc'
            }
        })
    }

    async getById(id: string) {
        const extension = await prisma.extension.findUnique({
            where: {
                id: id
            },
            select: extensionSelect
        })

        if (!extension) {
            throw new AppError('Extensão não encontrada', 404)
        }

        return extension
    }

    async update(id: string, data: UpdateExtensionType) {
        // Verifica se a extensão existe
        const existingExtension = await prisma.extension.findUnique({
            where: { id }
        })

        if (!existingExtension) {
            throw new AppError('Extensão não encontrada', 404)
        }

        // Se estiver alterando o alias, valida unicidade na empresa
        if (data.alias && data.alias !== existingExtension.alias) {
            const duplicateAlias = await prisma.extension.findUnique({
                where: {
                    companyId_alias: {
                        companyId: existingExtension.companyId,
                        alias: data.alias
                    }
                }
            })

            if (duplicateAlias) {
                throw new AppError('Já existe uma extensão com este alias nesta empresa', 409)
            }
        }

        // Se estiver alterando o callerIdNum, valida unicidade global
        if (data.callerIdNum && data.callerIdNum !== existingExtension.callerIdNum) {
            const duplicateNum = await prisma.extension.findFirst({
                where: {
                    callerIdNum: data.callerIdNum,
                    id: { not: id } // Exclui o ramal atual
                }
            })

            if (duplicateNum) {
                throw new AppError('Já existe um ramal com esse número (callerIdNum deve ser único globalmente)', 409)
            }
        }

        const updateData: any = {}

        if (data.name) updateData.name = data.name
        if (data.alias) updateData.alias = data.alias
        if (data.callerIdName) updateData.callerIdName = data.callerIdName
        if (data.callerIdNum) updateData.callerIdNum = data.callerIdNum
        if (data.typeExtension) updateData.typeExtension = data.typeExtension
        if (data.config) {
            // Valida e sanitiza o config antes de atualizar
            updateData.config = validateAndSanitizeConfig(data.config)
        }
        if (data.description !== undefined) updateData.description = data.description

        return await prisma.extension.update({
            where: {
                id: id
            },
            data: updateData,
            select: extensionSelect
        })
    }

    async delete(id: string) {
        const extension = await prisma.extension.findUnique({
            where: {
                id: id
            }
        })

        if (!extension) {
            throw new AppError('Extensão não encontrada', 404)
        }

        await prisma.extension.delete({
            where: {
                id: id
            }
        })

        return true
    }
}