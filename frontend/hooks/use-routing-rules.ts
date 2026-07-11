"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
    z.preprocess((v) => (v === "" || v === undefined ? undefined : v), inner.optional())

// Espelha routingConditionsSchema de
// backend/src/modules/callcenter/routing-rules/schemas/routing-rule.schema.ts
const routingConditionsFormSchema = z.object({
    trunkId: optionalText(z.string()),
    callerIdPattern: optionalText(z.string().max(80)),
    weekdays: z.preprocess(
        (v) => (Array.isArray(v) && v.length === 0 ? undefined : v),
        z.array(z.enum(WEEKDAYS)).min(1, "Selecione ao menos um dia").optional()
    ),
    startTime: optionalText(z.string().regex(timeRegex, "Horário inválido (HH:MM)")),
    endTime: optionalText(z.string().regex(timeRegex, "Horário inválido (HH:MM)")),
})

// companyId só existe no create — o PUT do backend não permite trocar a empresa da regra
export const createRoutingRuleFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    priority: z.coerce.number().int().min(0, "Mínimo 0").max(99, "Máximo 99").default(0),
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
export function useRoutingRules(companyId?: string) {
    const [routingRules, setRoutingRules] = useState<RoutingRule[]>([])
    const [loading, setLoading] = useState(true)

    const fetchRoutingRules = useCallback(async () => {
        if (!companyId) {
            setRoutingRules([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get(`/callcenter/routing-rules/company/${companyId}`)
            setRoutingRules(data.routingRules ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar regras de prioridade"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createRoutingRule = async (form: RoutingRuleForm) => {
        const id = toast.loading("Criando regra...")
        try {
            await api.post("/callcenter/routing-rules", form)
            toast.success("Regra criada", { id })
            await fetchRoutingRules()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar regra"), { id })
            return false
        }
    }

    const updateRoutingRule = async (routingRuleId: string, form: RoutingRuleUpdateForm) => {
        const id = toast.loading("Atualizando regra...")
        try {
            await api.put(`/callcenter/routing-rules/${routingRuleId}`, form)
            toast.success("Regra atualizada", { id })
            await fetchRoutingRules()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar regra"), { id })
            return false
        }
    }

    const deleteRoutingRule = async (routingRuleId: string) => {
        const id = toast.loading("Deletando regra...")
        try {
            await api.delete(`/callcenter/routing-rules/${routingRuleId}`)
            toast.success("Regra deletada", { id })
            await fetchRoutingRules()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar regra"), { id })
            return false
        }
    }

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchRoutingRules()
    }, [fetchRoutingRules, companyId])

    return {
        routingRules,
        loading,
        fetchRoutingRules,
        createRoutingRule,
        updateRoutingRule,
        deleteRoutingRule,
    }
}
