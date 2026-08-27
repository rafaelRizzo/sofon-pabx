"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export const VARIABLE_RULE_OPERATORS = [
    "filled",
    "empty",
    "length_eq",
    "length_neq",
    "length_gt",
    "length_gte",
    "length_lt",
    "length_lte",
    "eq",
    "neq",
    "contains",
    "regex",
    "gt",
    "gte",
    "lt",
    "lte",
    "cpf",
    "cnpj",
] as const

export type VariableRuleOperator = (typeof VARIABLE_RULE_OPERATORS)[number]

export const VARIABLE_RULE_OPERATOR_LABELS: Record<
    VariableRuleOperator,
    string
> = {
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
    cpf: "CPF válido",
    cnpj: "CNPJ válido",
}

// Operadores que não usam o campo "value": a UI esconde/desabilita o input pra esses.
// cpf/cnpj validam o dígito verificador do próprio valor da variável (ver checksumExpr em
// backend/src/asterisk/variablecondition.repository.ts), sem parâmetro, como filled/empty
const NO_VALUE_OPERATORS: readonly VariableRuleOperator[] = [
    "filled",
    "empty",
    "cpf",
    "cnpj",
]
const NUMERIC_VALUE_OPERATORS: readonly VariableRuleOperator[] = [
    "length_eq",
    "length_neq",
    "length_gt",
    "length_gte",
    "length_lt",
    "length_lte",
    "gt",
    "gte",
    "lt",
    "lte",
]

export function ruleNeedsValue(operator: VariableRuleOperator) {
    return !NO_VALUE_OPERATORS.includes(operator)
}

export type VariableRule = {
    variable: string
    operator: VariableRuleOperator
    value?: string
}
export type Combinator = "and" | "or"

export type VariableCondition = {
    id: string
    name: string
    companyId: string
    combinator: Combinator
    rules: VariableRule[]
    // não são mais editáveis por aqui - só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantidos no tipo só porque a
    // API ainda devolve os campos (label resolvido, usado em telas de leitura)
    trueRoute: RouteDestination
    falseRoute: RouteDestination
    usedBy: UsedByRef[]
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
            .regex(
                /^[^"\\]*$/,
                "Não pode conter aspas duplas ou barra invertida"
            )
            .optional(),
    })
    .refine(
        (r) =>
            !ruleNeedsValue(r.operator) ||
            (r.value !== undefined && r.value.length > 0),
        {
            message: "Valor obrigatório para este operador",
            path: ["value"],
        }
    )
    .refine(
        (r) =>
            !NUMERIC_VALUE_OPERATORS.includes(r.operator) ||
            /^-?\d+(\.\d+)?$/.test(r.value ?? ""),
        {
            message: "Valor deve ser numérico para este operador",
            path: ["value"],
        }
    )

// Espelha create/updateVariableConditionSchema de backend/src/modules/variable-conditions/schemas/variable-condition.schema.ts -
// companyId só existe no create, o PUT do backend não permite trocar empresa
export const createVariableConditionFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    combinator: z.enum(["and", "or"]),
    rules: z
        .array(ruleFieldSchema)
        .min(1, "Adicione ao menos uma regra")
        .max(20, "Máximo 20 regras"),
})

export const updateVariableConditionFormSchema =
    createVariableConditionFormSchema.omit({ companyId: true })

export type VariableConditionForm = z.infer<
    typeof createVariableConditionFormSchema
>
export type VariableConditionUpdateForm = z.infer<
    typeof updateVariableConditionFormSchema
>

// DTO de criação a partir do registro salvo (sem companyId - recriação sempre usa a empresa do
// flow) - usado pelo histórico de undo/redo do Flow pra recriar o recurso quando o usuário desfaz
// uma exclusão (ver flow-canvas.tsx)
export function toVariableConditionCreationDto(
    variableCondition: VariableCondition
): VariableConditionUpdateForm {
    return {
        name: variableCondition.name,
        combinator: variableCondition.combinator,
        rules: variableCondition.rules,
    }
}

// companyId opcional - enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
async function fetchVariableConditionsRequest(
    companyId: string
): Promise<VariableCondition[]> {
    const { data } = await api.get("/variable-conditions", {
        params: { companyId },
    })
    return data.variableConditions ?? []
}

export function useVariableConditions(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: variableConditions = [], isLoading: loading } = useQuery({
        queryKey: ["variable-conditions", companyId],
        queryFn: () => fetchVariableConditionsRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["variable-conditions"] })

    const createMutation = useMutation({
        mutationFn: (form: VariableConditionForm) =>
            api.post("/variable-conditions", form),
    })

    // companyId da condição vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    async function createVariableCondition(
        form: VariableConditionForm
    ): Promise<boolean>
    async function createVariableCondition(
        form: VariableConditionForm,
        withResourceId: true
    ): Promise<string | null>
    async function createVariableCondition(
        form: VariableConditionForm,
        withResourceId = false
    ) {
        const id = toast.loading("Criando condição de variável...")
        try {
            const { data } = await createMutation.mutateAsync(form)
            toast.success("Condição de variável criada", { id })
            await invalidate()
            return withResourceId ? (data.variableConditionId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar condição de variável"), {
                id,
            })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            variableConditionId,
            form,
        }: {
            variableConditionId: string
            form: VariableConditionUpdateForm
        }) => api.put(`/variable-conditions/${variableConditionId}`, form),
    })

    const updateVariableCondition = async (
        variableConditionId: string,
        form: VariableConditionUpdateForm
    ) => {
        const id = toast.loading("Atualizando condição de variável...")
        try {
            await updateMutation.mutateAsync({ variableConditionId, form })
            toast.success("Condição de variável atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(
                apiError(err, "Erro ao atualizar condição de variável"),
                { id }
            )
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (variableConditionId: string) =>
            api.delete(`/variable-conditions/${variableConditionId}`),
    })

    const deleteVariableCondition = async (variableConditionId: string) => {
        const id = toast.loading("Deletando condição de variável...")
        try {
            await deleteMutation.mutateAsync(variableConditionId)
            toast.success("Condição de variável deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar condição de variável"), {
                id,
            })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            variableConditions.filter((v) =>
                v.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [variableConditions, filter]
    )

    return {
        variableConditions: filtered,
        loading,
        filter,
        setFilter,
        fetchVariableConditions: invalidate,
        createVariableCondition,
        updateVariableCondition,
        deleteVariableCondition,
    }
}
