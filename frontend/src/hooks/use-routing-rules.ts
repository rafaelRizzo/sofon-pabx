"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { WEEKDAYS, type Weekday } from "@/hooks/use-time-groups"

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export type RoutingRuleConditions = {
    trunkId?: string
    callerIdPattern?: string
    weekdays?: Weekday[]
    startTime?: string
    endTime?: string
}

export type RoutingRule = {
    id: string
    name: string
    companyId: string
    priority: number
    conditions: RoutingRuleConditions
    active: boolean
    createdAt: string
    updatedAt: string
}

// Campo de texto opcional — string vazia (campo não preenchido no form) vira undefined em vez
// de cair na validação de formato (regex/max), que só é aplicada quando o campo é usado
const optionalText = (inner: z.ZodString) =>
    z.preprocess(
        (v) => (v === "" || v === undefined ? undefined : v),
        inner.optional()
    )

// Espelha routingConditionsSchema de
// backend/src/modules/callcenter/routing-rules/schemas/routing-rule.schema.ts
const routingConditionsFormSchema = z.object({
    trunkId: optionalText(z.string()),
    callerIdPattern: optionalText(z.string().max(80)),
    weekdays: z.preprocess(
        (v) => (Array.isArray(v) && v.length === 0 ? undefined : v),
        z.array(z.enum(WEEKDAYS)).min(1, "Selecione ao menos um dia").optional()
    ),
    startTime: optionalText(
        z.string().regex(timeRegex, "Horário inválido (HH:MM)")
    ),
    endTime: optionalText(
        z.string().regex(timeRegex, "Horário inválido (HH:MM)")
    ),
})

// companyId só existe no create — o PUT do backend não permite trocar a empresa da regra
export const createRoutingRuleFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    priority: z.coerce
        .number()
        .int()
        .min(0, "Mínimo 0")
        .max(99, "Máximo 99")
        .default(0),
    conditions: routingConditionsFormSchema.default({}),
    active: z.boolean().default(true),
})

export const updateRoutingRuleFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    priority: z.coerce.number().int().min(0, "Mínimo 0").max(99, "Máximo 99"),
    conditions: routingConditionsFormSchema.default({}),
    active: z.boolean(),
})

export type RoutingRuleForm = z.infer<typeof createRoutingRuleFormSchema>
export type RoutingRuleUpdateForm = z.infer<typeof updateRoutingRuleFormSchema>

// companyId é obrigatório — o backend só lista regras por empresa (path param), sem opção de
// "todas as empresas"
async function fetchRoutingRulesRequest(
    companyId: string
): Promise<RoutingRule[]> {
    const { data } = await api.get(
        `/callcenter/routing-rules/company/${companyId}`
    )
    return data.routingRules ?? []
}

export function useRoutingRules(companyId?: string) {
    const queryClient = useQueryClient()

    const { data: routingRules = [], isLoading: loading } = useQuery({
        queryKey: ["routing-rules", companyId],
        queryFn: () => fetchRoutingRulesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["routing-rules"] })

    const createMutation = useMutation({
        mutationFn: (form: RoutingRuleForm) =>
            api.post("/callcenter/routing-rules", form),
    })

    const createRoutingRule = async (form: RoutingRuleForm) => {
        const id = toast.loading("Criando regra...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Regra criada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar regra"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            routingRuleId,
            form,
        }: {
            routingRuleId: string
            form: RoutingRuleUpdateForm
        }) => api.put(`/callcenter/routing-rules/${routingRuleId}`, form),
    })

    const updateRoutingRule = async (
        routingRuleId: string,
        form: RoutingRuleUpdateForm
    ) => {
        const id = toast.loading("Atualizando regra...")
        try {
            await updateMutation.mutateAsync({ routingRuleId, form })
            toast.success("Regra atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar regra"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (routingRuleId: string) =>
            api.delete(`/callcenter/routing-rules/${routingRuleId}`),
    })

    const deleteRoutingRule = async (routingRuleId: string) => {
        const id = toast.loading("Deletando regra...")
        try {
            await deleteMutation.mutateAsync(routingRuleId)
            toast.success("Regra deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar regra"), { id })
            return false
        }
    }

    return {
        routingRules,
        loading,
        fetchRoutingRules: invalidate,
        createRoutingRule,
        updateRoutingRule,
        deleteRoutingRule,
    }
}
