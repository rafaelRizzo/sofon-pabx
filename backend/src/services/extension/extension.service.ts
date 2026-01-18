import type { ExtensionType } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/handler.error'
import asterisk from '../../lib/asterisk'
import { promises as fs } from 'fs'
import path from 'path'

type ExtensionDataType = {
    name: string
    alias: string
    companyId: string
    callerIdName: string
    callerIdNum: string
    typeExtension: ExtensionType
    config: object
    description?: string
    enableRegister?: boolean
    registerString?: string
}

type UpdateExtensionType = Partial<ExtensionDataType>

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
    'useclientcode',
    'fromuser',
    'fromdomain'
] as const

const ASTERISK_CONFIG_PATH = process.env.ASTERISK_CONFIG_PATH || '/etc/asterisk'
const PJSIP_CONFIG_FILE = path.join(ASTERISK_CONFIG_PATH, 'pjsip_extensions.conf')
const SIP_CONFIG_FILE = path.join(ASTERISK_CONFIG_PATH, 'sip_extensions.conf')
const SIP_REGISTER_FILE = path.join(ASTERISK_CONFIG_PATH, 'sip_register.conf')

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
    enableRegister: true,
    registerString: true,
    createdAt: true,
    updatedAt: true
}

function validateAndSanitizeConfig(config: any): object {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new AppError('Config deve ser um objeto válido', 400)
    }

    const sanitizedConfig: any = {}

    for (const key of Object.keys(config)) {
        if (!ALLOWED_CONFIG_FIELDS.includes(key as any)) {
            throw new AppError(`Campo '${key}' não é permitido no config`, 400)
        }

        const value = config[key]

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            value !== null
        ) {
            throw new AppError(`Valor do campo '${key}' deve ser string, número, booleano ou null`, 400)
        }

        if (typeof value === 'string') {
            const sanitized = value
                .replace(/[<>]/g, '')
                .replace(/\${.*?}/g, '')
                .replace(/`/g, '')
                .trim()

            if (sanitized.length > 500) {
                throw new AppError(`Valor do campo '${key}' excede o tamanho máximo (500 caracteres)`, 400)
            }

            sanitizedConfig[key] = sanitized
        } else {
            sanitizedConfig[key] = value
        }
    }

    const jsonSize = JSON.stringify(sanitizedConfig).length
    if (jsonSize > 10000) {
        throw new AppError('Config excede o tamanho máximo permitido (10KB)', 400)
    }

    return sanitizedConfig
}

function generatePJSIPConfig(extension: any): string {
    const config = extension.config as any

    let output = `; ${extension.description || extension.name}\n`
    output += `[${extension.callerIdNum}]\n`
    output += `type=endpoint\n`
    output += `context=${config.context || 'ramais'}\n`
    output += `disallow=all\n`
    output += `allow=${config.allow || 'ulaw,alaw,opus'}\n`
    output += `auth=${extension.callerIdNum}\n`
    output += `aors=${extension.callerIdNum}\n`

    if (extension.enableRegister) {
        output += `outbound_auth=${extension.callerIdNum}\n`
    }

    output += `callerid="${extension.callerIdName}" <${extension.callerIdNum}>\n`
    output += `direct_media=${config.directmedia || 'no'}\n`
    output += `dtmf_mode=${config.dtmfmode || 'rfc4733'}\n`

    if (config.transport) output += `transport=${config.transport}\n`
    if (config.encryption) output += `media_encryption=${config.encryption}\n`
    if (config.avpf) output += `use_avpf=${config.avpf}\n`
    if (config.icesupport) output += `ice_support=${config.icesupport}\n`

    output += `\n[${extension.callerIdNum}]\n`
    output += `type=auth\n`
    output += `auth_type=userpass\n`
    output += `username=${extension.callerIdNum}\n`
    output += `password=${config.secret || 'changeme'}\n`

    output += `\n[${extension.callerIdNum}]\n`
    output += `type=aor\n`
    output += `max_contacts=1\n`
    output += `remove_existing=yes\n`
    if (config.qualify) output += `qualify_frequency=${config.qualify}\n`

    if (extension.enableRegister && extension.registerString) {
        output += `\n; Registro externo\n`
        output += `[${extension.callerIdNum}]\n`
        output += `type=registration\n`
        output += `${extension.registerString}\n`
    }

    output += `\n`
    return output
}

function generateSIPConfig(extension: any): string {
    const config = extension.config as any

    let output = `; ${extension.description || extension.name}\n`
    output += `[${extension.callerIdNum}]\n`
    output += `type=${config.type || 'friend'}\n`
    output += `secret=${config.secret || 'changeme'}\n`
    output += `context=${config.context || 'ramais'}\n`
    output += `host=${config.host || 'dynamic'}\n`
    output += `callerid="${extension.callerIdName}" <${extension.callerIdNum}>\n`
    output += `disallow=all\n`
    output += `allow=${config.allow || 'ulaw,alaw,gsm'}\n`
    output += `nat=${config.nat || 'no'}\n`
    output += `qualify=${config.qualify || 'yes'}\n`
    output += `directmedia=${config.directmedia || 'no'}\n`
    output += `dtmfmode=${config.dtmfmode || 'rfc2833'}\n`

    if (config.transport) output += `transport=${config.transport}\n`
    if (config.encryption) output += `encryption=${config.encryption}\n`
    if (config.insecure) output += `insecure=${config.insecure}\n`
    if (config.port) output += `port=${config.port}\n`
    if (config.canreinvite) output += `canreinvite=${config.canreinvite}\n`
    if (config.accountcode) output += `accountcode=${config.accountcode}\n`
    if (config.amaflags) output += `amaflags=${config.amaflags}\n`
    if (config.callgroup) output += `callgroup=${config.callgroup}\n`
    if (config.pickupgroup) output += `pickupgroup=${config.pickupgroup}\n`
    if (config.mailbox) output += `mailbox=${config.mailbox}\n`
    if (config.deny) output += `deny=${config.deny}\n`
    if (config.permit) output += `permit=${config.permit}\n`
    if (config.md5secret) output += `md5secret=${config.md5secret}\n`
    if (config.sendrpid) output += `sendrpid=${config.sendrpid}\n`
    if (config.trustrpid) output += `trustrpid=${config.trustrpid}\n`
    if (config.progressinband) output += `progressinband=${config.progressinband}\n`
    if (config.promiscredir) output += `promiscredir=${config.promiscredir}\n`
    if (config.useclientcode) output += `useclientcode=${config.useclientcode}\n`
    if (config.fromuser) output += `fromuser=${config.fromuser}\n`
    if (config.fromdomain) output += `fromdomain=${config.fromdomain}\n`

    output += `\n`
    return output
}

async function regenerateConfigFiles(): Promise<void> {
    try {
        const extensions = await prisma.extension.findMany({
            select: extensionSelect,
            orderBy: { alias: 'asc' }
        })

        // ============================================
        // GERAR CONFIGURAÇÃO PJSIP
        // ============================================
        let pjsipContent = `;============================================\n`
        pjsipContent += `; EXTENSÕES PJSIP - GERADO AUTOMATICAMENTE\n`
        pjsipContent += `; NÃO EDITE MANUALMENTE - Use a API\n`
        pjsipContent += `; Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`
        pjsipContent += `;============================================\n`

        extensions.forEach(ext => {
            if (ext.typeExtension === 'PJSIP') {
                pjsipContent += generatePJSIPConfig(ext)
            }
        })

        // ============================================
        // GERAR CONFIGURAÇÃO SIP (sem registros)
        // ============================================
        let sipContent = `;============================================\n`
        sipContent += `; EXTENSÕES SIP - GERADO AUTOMATICAMENTE\n`
        sipContent += `; NÃO EDITE MANUALMENTE - Use a API\n`
        sipContent += `; Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`
        sipContent += `;============================================\n`

        extensions.forEach(ext => {
            if (ext.typeExtension === 'SIP') {
                sipContent += generateSIPConfig(ext)
            }
        })

        // ============================================
        // GERAR ARQUIVO DE REGISTROS SIP (separado, SEM [general])
        // ============================================
        const sipRegistrations = extensions.filter(ext =>
            ext.typeExtension === 'SIP' &&
            ext.enableRegister &&
            ext.registerString
        )

        let registerContent = `;============================================\n`
        registerContent += `; REGISTROS SIP - GERADO AUTOMATICAMENTE\n`
        registerContent += `; NÃO EDITE MANUALMENTE - Use a API\n`
        registerContent += `; Este arquivo é incluído dentro do [general]\n`
        registerContent += `; Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`
        registerContent += `;============================================\n`

        if (sipRegistrations.length > 0) {
            sipRegistrations.forEach(ext => {
                registerContent += `register => ${ext.registerString}\n`
            })
        } else {
            registerContent += `; Nenhum registro configurado\n`
        }

        // ============================================
        // CRIAR BACKUPS
        // ============================================
        const timestamp = new Date().getTime()

        try {
            await fs.access(PJSIP_CONFIG_FILE)
            await fs.copyFile(PJSIP_CONFIG_FILE, `${PJSIP_CONFIG_FILE}.${timestamp}.backup`)
        } catch { }

        try {
            await fs.access(SIP_CONFIG_FILE)
            await fs.copyFile(SIP_CONFIG_FILE, `${SIP_CONFIG_FILE}.${timestamp}.backup`)
        } catch { }

        try {
            await fs.access(SIP_REGISTER_FILE)
            await fs.copyFile(SIP_REGISTER_FILE, `${SIP_REGISTER_FILE}.${timestamp}.backup`)
        } catch { }

        // ============================================
        // ESCREVER ARQUIVOS
        // ============================================
        await fs.writeFile(PJSIP_CONFIG_FILE, pjsipContent, 'utf8')
        await fs.writeFile(SIP_CONFIG_FILE, sipContent, 'utf8')
        await fs.writeFile(SIP_REGISTER_FILE, registerContent, 'utf8')

        console.log('✓ Arquivos de configuração regenerados')
    } catch (error) {
        console.error('✗ Erro ao regenerar arquivos de configuração:', error)
        throw new AppError('Erro ao gerar arquivos de configuração do Asterisk', 500)
    }
}

async function ensureConfigIncludes(): Promise<void> {
    try {
        // ============================================
        // PJSIP INCLUDE
        // ============================================
        const pjsipMainFile = path.join(ASTERISK_CONFIG_PATH, 'pjsip.conf')
        const pjsipIncludeLine = `#include "pjsip_extensions.conf"`

        try {
            const pjsipContent = await fs.readFile(pjsipMainFile, 'utf8')
            if (!pjsipContent.includes(pjsipIncludeLine)) {
                await fs.appendFile(pjsipMainFile, `\n${pjsipIncludeLine}\n`)
                console.log('✓ Include adicionado ao pjsip.conf')
            }
        } catch (error) {
            console.warn('⚠ Não foi possível adicionar include ao pjsip.conf:', error)
        }

        // ============================================
        // SIP INCLUDES
        // ============================================
        const sipMainFile = path.join(ASTERISK_CONFIG_PATH, 'sip.conf')
        const sipExtInclude = `#include "sip_extensions.conf"`
        const sipRegInclude = `#include "sip_register.conf"`

        try {
            let sipContent = await fs.readFile(sipMainFile, 'utf8')
            let modified = false

            // Adicionar include de registros DENTRO do [general]
            if (!sipContent.includes(sipRegInclude)) {
                const generalRegex = /\[general\]/
                const match = sipContent.match(generalRegex)

                if (match && match.index !== undefined) {
                    const insertPos = match.index + match[0].length
                    sipContent = sipContent.slice(0, insertPos) +
                        `\n${sipRegInclude}\n` +
                        sipContent.slice(insertPos)
                    modified = true
                    console.log('✓ Include de registros adicionado dentro do [general] no sip.conf')
                }
            }

            // Adicionar include de extensões no final
            if (!sipContent.includes(sipExtInclude)) {
                sipContent += `\n${sipExtInclude}\n`
                modified = true
                console.log('✓ Include de extensões adicionado ao sip.conf')
            }

            if (modified) {
                await fs.writeFile(sipMainFile, sipContent, 'utf8')
            }
        } catch (error) {
            console.warn('⚠ Não foi possível adicionar includes ao sip.conf:', error)
        }
    } catch (error) {
        console.error('✗ Erro ao verificar includes:', error)
    }
}

async function reloadAsterisk(): Promise<void> {
    try {
        await regenerateConfigFiles()
        await ensureConfigIncludes()
        await Promise.allSettled([
            asterisk.reloadSIP(),
            asterisk.reloadPJSIP()
        ])
        console.log('✓ Asterisk recarregado com sucesso')
    } catch (error) {
        console.error('✗ Erro ao recarregar Asterisk:', error)
        throw new AppError('Erro ao recarregar configurações do Asterisk', 500)
    }
}

export class ExtensionService {

    async create(extension: ExtensionDataType) {
        const companyExists = await prisma.company.findUnique({
            where: { id: extension.companyId }
        })

        if (!companyExists) {
            throw new AppError('Empresa não encontrada', 404)
        }

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

        const existingExtensionByNum = await prisma.extension.findUnique({
            where: {
                callerIdNum: extension.callerIdNum
            }
        })

        if (existingExtensionByNum) {
            throw new AppError('Ramal já cadastrado com este número (callerIdNum deve ser único globalmente)', 409)
        }

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
                description: extension.description,
                enableRegister: extension.enableRegister || false,
                registerString: extension.registerString
            },
            select: extensionSelect
        })

        await reloadAsterisk()
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
            where: { id },
            select: extensionSelect
        })

        if (!extension) {
            throw new AppError('Extensão não encontrada', 404)
        }

        return extension
    }

    async update(id: string, data: UpdateExtensionType) {
        const existingExtension = await prisma.extension.findUnique({
            where: { id }
        })

        if (!existingExtension) {
            throw new AppError('Extensão não encontrada', 404)
        }

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

        if (data.callerIdNum && data.callerIdNum !== existingExtension.callerIdNum) {
            const duplicateNum = await prisma.extension.findFirst({
                where: {
                    callerIdNum: data.callerIdNum,
                    id: { not: id }
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
        if (data.config) updateData.config = validateAndSanitizeConfig(data.config)
        if (data.description !== undefined) updateData.description = data.description
        if (data.enableRegister !== undefined) updateData.enableRegister = data.enableRegister
        if (data.registerString !== undefined) updateData.registerString = data.registerString

        const updatedExtension = await prisma.extension.update({
            where: { id },
            data: updateData,
            select: extensionSelect
        })

        await reloadAsterisk()
        return updatedExtension
    }

    async delete(id: string) {
        const extension = await prisma.extension.findUnique({
            where: { id }
        })

        if (!extension) {
            throw new AppError('Extensão não encontrada', 404)
        }

        await prisma.extension.delete({
            where: { id }
        })

        await reloadAsterisk()
        return true
    }

    async syncAll(): Promise<void> {
        await reloadAsterisk()
    }
}