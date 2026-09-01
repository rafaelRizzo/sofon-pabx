import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { AppError } from '../../utils/errors/app.error'
import type { CreateVariableInput, UpdateVariableInput } from './schemas/variable-catalog.schema'
import type { Assignment } from '../variables/schemas/variable.schema'
import type { IxcNodeVariableMapping } from '../ixc-nodes/schemas/ixc-node.schema'
import { type UsedByRef } from '../../schemas/flow-reference-label'

const select = {
    id: true,
    name: true,
    companyId: true,
    description: true,
    createdAt: true,
    updatedAt: true,
} as const

const USAGE_TYPE_LABELS = {
    ivrmenu: 'Menu IVR',
    variableset: 'Variáveis',
    ixcnode: 'IXCsoft',
} as const

// Quem referencia esse nome de variável hoje - IvrMenu.variableName é coluna própria, já filtra no
// banco; VariableSet.assignments e IxcNode.variableMappings são Json, então o filtro é em memória
// (poucas dezenas de linhas por empresa, não justifica índice/jsonb query). Sem FK entre Variable e
// essas tabelas (ver comentário do model no schema.prisma) - diferente do usedBy de destino de rota
// (flow-reference-label.ts), que é resolvido via FlowEdgeRepository; aqui não há tabela de índice
// reverso, então batcheamos manualmente por tipo de origem (1 query por tabela, não por variável).
async function resolveVariablesUsedBy(names: string[], companyId: string): Promise<Map<string, UsedByRef[]>> {
    const result = new Map<string, UsedByRef[]>(names.map((name) => [name, []]))
    if (names.length === 0) return result

    const [ivrMenus, variableSets, ixcNodes] = await Promise.all([
        prisma.ivrMenu.findMany({ where: { companyId, variableName: { in: names } }, select: { id: true, name: true, variableName: true } }),
        prisma.variableSet.findMany({ where: { companyId }, select: { id: true, name: true, assignments: true } }),
        prisma.ixcNode.findMany({ where: { companyId }, select: { id: true, name: true, variableMappings: true } }),
    ])

    const push = (name: string, ref: UsedByRef) => result.get(name)?.push(ref)

    for (const menu of ivrMenus) {
        if (menu.variableName) push(menu.variableName, { sourceType: 'ivrmenu', sourceId: menu.id, slot: 'default', label: `${USAGE_TYPE_LABELS.ivrmenu}: ${menu.name}` })
    }
    for (const vs of variableSets) {
        const assignedNames = new Set((vs.assignments as Assignment[]).map((a) => a.variable))
        for (const name of assignedNames) push(name, { sourceType: 'variableset', sourceId: vs.id, slot: 'default', label: `${USAGE_TYPE_LABELS.variableset}: ${vs.name}` })
    }
    for (const node of ixcNodes) {
        const mappedNames = new Set((node.variableMappings as IxcNodeVariableMapping[]).map((m) => m.variable))
        for (const name of mappedNames) push(name, { sourceType: 'ixcnode', sourceId: node.id, slot: 'default', label: `${USAGE_TYPE_LABELS.ixcnode}: ${node.name}` })
    }

    return result
}

export const getVariablesByCompany = async (companyId: string) => {
    const variables = await prisma.variable.findMany({ where: { companyId }, select, orderBy: { name: 'asc' } })
    const usedByMap = await resolveVariablesUsedBy(variables.map((v) => v.name), companyId)
    return variables.map((v) => ({ ...v, usedBy: usedByMap.get(v.name) ?? [] }))
}

export const getVariableById = async (id: string) => {
    const variable = await prisma.variable.findUnique({ where: { id }, select })
    if (!variable) throw new AppError('Variable not found', 404)
    const usedByMap = await resolveVariablesUsedBy([variable.name], variable.companyId)
    return { ...variable, usedBy: usedByMap.get(variable.name) ?? [] }
}

export const createVariable = async (data: CreateVariableInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.variable.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Variable already exists for this company', 409)

    return prisma.variable.create({
        data: { name: data.name, companyId: data.companyId, description: data.description ?? null },
        select,
    })
}

export const updateVariable = async (id: string, data: UpdateVariableInput) => {
    const existing = await prisma.variable.findUnique({ where: { id } })
    if (!existing) throw new AppError('Variable not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const conflict = await prisma.variable.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Variable name already in use for this company', 409)
    }

    return prisma.variable.update({
        where: { id },
        data: { name: data.name, description: data.description },
        select,
    })
}

export const deleteVariable = async (id: string) => {
    const existing = await prisma.variable.findUnique({ where: { id } })
    if (!existing) throw new AppError('Variable not found', 404)

    const usedByMap = await resolveVariablesUsedBy([existing.name], existing.companyId)
    const usedBy = usedByMap.get(existing.name) ?? []
    if (usedBy.length > 0)
        throw new AppError(`Variable is in use by: ${usedBy.map((ref) => ref.label).join(', ')}`, 409)

    await prisma.variable.delete({ where: { id } })
}

// valida que o nome existe no catálogo da empresa - usado por IvrMenu (modo collect) e VariableSet
// (assignments[].variable) ao criar/editar, mesmo padrão de assertAudioBelongsToCompany
// (audios.service.ts) pra manter os dois campos como texto solto (sem virar FK) mas ainda
// garantidos contra typo/drift.
export const assertVariableExistsForCompany = async (name: string, companyId: string) => {
    const variable = await prisma.variable.findUnique({
        where: { name_companyId: { name, companyId } },
        select: { id: true },
    })
    if (!variable) throw new AppError(`Variable '${name}' not found in catalog for this company`, 404)
}
