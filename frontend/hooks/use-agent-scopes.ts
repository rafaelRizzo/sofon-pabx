"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type AgentScope = {
    id: string
    extensionId: string
    companyId: string
    active: boolean
    createdAt: string
    updatedAt: string
}

// Espelha createAgentScopeSchema de backend/src/modules/callcenter/agents/schemas/agent-scope.schema.ts
export const createAgentScopeFormSchema = z.object({
    extensionId: z.string().min(1, "Selecione um ramal"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    active: z.boolean().default(true),
})

export type AgentScopeForm = z.infer<typeof createAgentScopeFormSchema>

// Sem filtro "todas as empresas": o backend só lista por empresa (path param), não há
// endpoint de listagem geral — companyId é sempre obrigatório aqui
export function useAgentScopes(companyId?: string) {
    const [scopes, setScopes] = useState<AgentScope[]>([])
    const [loading, setLoading] = useState(true)

    const fetchScopes = useCallback(async () => {
        if (!companyId) {
            setScopes([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get(`/callcenter/agents/company/${companyId}`)
            setScopes(data.scopes ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar elegibilidade de agentes"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    const createScope = async (form: AgentScopeForm) => {
        const id = toast.loading("Vinculando agente...")
        try {
            await api.post("/callcenter/agents", form)
            toast.success("Agente vinculado à empresa", { id })
            await fetchScopes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao vincular agente"), { id })
            return false
        }
    }

    const toggleScopeActive = async (scopeId: string, active: boolean) => {
        const id = toast.loading(active ? "Ativando..." : "Desativando...")
        try {
            await api.patch(`/callcenter/agents/${scopeId}`, { active })
            toast.success(active ? "Agente ativado" : "Agente desativado", { id })
            await fetchScopes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar agente"), { id })
            return false
        }
    }

    const deleteScope = async (scopeId: string) => {
        const id = toast.loading("Removendo vínculo...")
        try {
            await api.delete(`/callcenter/agents/${scopeId}`)
            toast.success("Vínculo removido", { id })
            await fetchScopes()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao remover vínculo"), { id })
            return false
        }
    }

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchScopes()
    }, [fetchScopes, companyId])

    return {
        scopes,
        loading,
        fetchScopes,
        createScope,
        toggleScopeActive,
        deleteScope,
    }
}
