import { z } from 'zod'
import { timestamp, cuidParam, ok } from '../../../schemas/responses'
import { routeDestinationSchema, routeDestinationResponseSchema } from '../../../schemas/route-destination.schema'

export const idParamSchema = z.object({ id: cuidParam })
export const companyQuerySchema = z.object({ companyId: z.cuid2() })

export const VARIABLE_RULE_OPERATORS = [
    'filled', 'empty',
    'length_eq', 'length_neq', 'length_gt', 'length_gte', 'length_lt', 'length_lte',
    'eq', 'neq', 'contains', 'regex',
    'gt', 'gte', 'lt', 'lte',
    'cpf', 'cnpj',
] as const

const NUMERIC_VALUE_OPS: readonly string[] = ['length_eq', 'length_neq', 'length_gt', 'length_gte', 'length_lt', 'length_lte', 'gt', 'gte', 'lt', 'lte']
// cpf/cnpj validam o dígito verificador do valor da própria variável, sem parâmetro, mesmo
// grupo de filled/empty (ver checksumExpr em asterisk/variablecondition.repository.ts)
const NO_VALUE_OPS: readonly string[] = ['filled', 'empty', 'cpf', 'cnpj']

// nome simples (MYVAR) ou chamada de função Asterisk (CALLERID(num), DB(family/key))
const VARIABLE_REGEX = /^[A-Za-z_][A-Za-z0-9_]*(\([A-Za-z0-9_:,.\- ]*\))?$/

const ruleSchema = z.object({
    variable: z.string().min(1).max(80).regex(VARIABLE_REGEX, 'Invalid variable name — use a plain identifier or a function call like CALLERID(num)'),
    operator: z.enum(VARIABLE_RULE_OPERATORS),
    value: z.string().max(200).regex(/^[^"\\]*$/, 'Cannot contain double quotes or backslash').optional(),
}).refine((r) => NO_VALUE_OPS.includes(r.operator) || (r.value !== undefined && r.value.length > 0), {
    message: 'value is required for this operator',
    path: ['value'],
}).refine((r) => !NUMERIC_VALUE_OPS.includes(r.operator) || /^-?\d+(\.\d+)?$/.test(r.value ?? ''), {
    message: 'value must be numeric for this operator',
    path: ['value'],
})

export const createVariableConditionSchema = z.object({
    name: z.string().min(1).max(80),
    companyId: z.cuid2(),
    combinator: z.enum(['and', 'or']).default('and'),
    rules: z.array(ruleSchema).min(1).max(20),
    trueRoute: routeDestinationSchema.optional(),
    falseRoute: routeDestinationSchema.optional(),
})

export const updateVariableConditionSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    combinator: z.enum(['and', 'or']).optional(),
    rules: z.array(ruleSchema).min(1).max(20).optional(),
    trueRoute: routeDestinationSchema.optional(),
    falseRoute: routeDestinationSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required: name, combinator, rules, trueRoute, falseRoute' })

export type CreateVariableConditionInput = z.infer<typeof createVariableConditionSchema>
export type UpdateVariableConditionInput = z.infer<typeof updateVariableConditionSchema>
export type VariableRuleInput = z.infer<typeof ruleSchema>

const VariableRuleResponseSchema = z.object({
    variable: z.string(),
    operator: z.enum(VARIABLE_RULE_OPERATORS),
    value: z.string().optional(),
})

export const VariableConditionSchema = z.object({
    id: z.string(),
    name: z.string(),
    companyId: z.string(),
    combinator: z.enum(['and', 'or']),
    rules: z.array(VariableRuleResponseSchema),
    trueRoute: routeDestinationResponseSchema,
    falseRoute: routeDestinationResponseSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
})

export const ListVariableConditionsResponse = ok({ message: z.string(), variableConditions: z.array(VariableConditionSchema) })
export const GetVariableConditionResponse = ok({ message: z.string(), variableCondition: VariableConditionSchema })
export const CreateVariableConditionResponse = ok({ message: z.string(), variableConditionId: z.string() })
export const UpdateVariableConditionResponse = ok({ message: z.string() })
