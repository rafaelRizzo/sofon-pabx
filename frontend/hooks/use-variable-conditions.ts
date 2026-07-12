"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { routeDestinationSchema, type RouteDestination } from "@/components/RouteDestination/route-destination-field"

export const VARIABLE_RULE_OPERATORS = [
    "filled", "empty",
    "length_eq", "length_neq", "length_gt", "length_gte", "length_lt", "length_lte",
    "eq", "neq", "contains", "regex",
    "gt", "gte", "lt", "lte",
] as const

export type VariableRuleOperator = (typeof VARIABLE_RULE_OPERATORS)[number]

export const VARIABLE_RULE_OPERATOR_LABELS: Record<VariableRuleOperator, string> = {
    filled: "Preenchida",
    empty: "Vazia",
    length_eq: "Tamanho =",
    length_neq: "Tamanho ≠",
    length_gt: "Tamanho >",
    length_gte: "Tamanho ≥",
    length_lt: "Tamanho <",
    length_lte: "Tamanho ≤",
    eq: "Igual a",
    neq: "Diferente de",
    contains: "Contém",
    regex: "Combina com regex",
    gt: "Maior que",
    gte: "Maior ou igual a",
    lt: "Menor que",
    lte: "Menor ou igual a",
}

// Operadores que não usam o campo "value" — a UI esconde/desabilita o input pra esses
const NO_VALUE_OPERATORS: readonly VariableRuleOperator[] = ["filled", "empty"]
const NUMERIC_VALUE_OPERATORS: readonly VariableRuleOperator[] = [
    "length_eq", "length_neq", "length_gt", "length_gte", "length_lt", "length_lte", "gt", "gte", "lt", "lte",
]

export function ruleNeedsValue(operator: VariableRuleOperator) {
    return !NO_VALUE_OPERATORS.includes(operator)
}

export type VariableRule = { variable: string; operator: VariableRuleOperator; value?: string }
export type Combinator = "and" | "or"

export type VariableCondition = {
    id: string
    name: string
    companyId: string
    combinator: Combinator
    rules: VariableRule[]
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    createdAt: string
    updatedAt: string
}

// Espelha ruleSchema de backend/src/modules/variable-conditions/schemas/variable-condition.schema.ts
const ruleFieldSchema = z
    .object({
        variable: z
            .string()
            .min(1, "Informe a variável")
            .max(80, "Máximo 80 caracteres")
            .regex(
                /^[A-Za-z_][A-Za-z0-9_]*(\([A-Za-z0-9_:,.\- ]*\))?$/,
                "Use um identificador simples ou uma chamada de função como CALLERID(num)"
            ),
        operator: z.enum(VARIABLE_RULE_OPERATORS),
        value: z
            .string()
            .max(200, "Máximo 200 caracteres")
            .regex(/^[^"\\]*$/, "Não pode conter aspas duplas ou barra invertida")
            .optional(),
    })
    .refine((r) => !ruleNeedsValue(r.operator) || (r.value !== undefined && r.value.length > 0), {
        message: "Valor obrigatório para este operador",
        path: ["value"],
    })
    .refine((r) => !NUMERIC_VALUE_OPERATORS.includes(r.operator) || /^-?\d+(\.\d+)?$/.test(r.value ?? ""), {
        message: "Valor deve ser numérico para este operador",
        path: ["value"],
    })

// Espelha create/updateVariableConditionSchema de backend/src/modules/variable-conditions/schemas/variable-condition.schema.ts —
// companyId só existe no create, o PUT do backend não permite trocar empresa
export const createVariableConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    combinator: z.enum(["and", "or"]),
    rules: z.array(ruleFieldSchema).min(1, "Adicione ao menos uma regra").max(20, "Máximo 20 regras"),
    trueRoute: routeDestinationSchema,
    falseRoute: routeDestinationSchema,
})

export const updateVariableConditionFormSchema = createVariableConditionFormSchema.omit({ companyId: true })

export type VariableConditionForm = z.infer<typeof createVariableConditionFormSchema>
export type VariableConditionUpdateForm = z.infer<typeof updateVariableConditionFormSchema>

// companyId opcional — omitido, busca todas as condições no escopo do usuário, permitindo o
// filtro "Todas as empresas" na página
export function useVariableConditions(companyId?: string) {
    const [variableConditions, setVariableConditions] = useState<VariableCondition[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchVariableConditions = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/variable-conditions", {
                params: companyId ? { companyId } : undefined,
            })
            setVariableConditions(data.variableConditions ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar condições de variável"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId da condição vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    const createVariableCondition = async (form: VariableConditionForm) => {
        const id = toast.loading("Criando condição de variável...")
        try {
            await api.post("/variable-conditions", form)
            toast.success("Condição de variável criada", { id })
            await fetchVariableConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar condição de variável"), { id })
            return false
        }
    }

    const updateVariableCondition = async (variableConditionId: string, form: VariableConditionUpdateForm) => {
        const id = toast.loading("Atualizando condição de variável...")
        try {
            await api.put(`/variable-conditions/${variableConditionId}`, form)
            toast.success("Condição de variável atualizada", { id })
            await fetchVariableConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar condição de variável"), { id })
            return false
        }
    }

    const deleteVariableCondition = async (variableConditionId: string) => {
        const id = toast.loading("Deletando condição de variável...")
        try {
            await api.delete(`/variable-conditions/${variableConditionId}`)
            toast.success("Condição de variável deletada", { id })
            await fetchVariableConditions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar condição de variável"), { id })
            return false
        }
    }

    const filtered = variableConditions.filter((v) =>
        v.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchVariableConditions()
    }, [fetchVariableConditions, companyId])

    return {
        variableConditions: filtered,
        loading,
        filter,
        setFilter,
        fetchVariableConditions,
        createVariableCondition,
        updateVariableCondition,
        deleteVariableCondition,
    }
}
