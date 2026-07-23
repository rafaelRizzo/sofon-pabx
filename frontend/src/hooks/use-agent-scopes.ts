"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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

async function fetchScopesRequest(companyId: string): Promise<AgentScope[]> {
    const { data } = await api.get(`/callcenter/agents/company/${companyId}`)
    return data.scopes ?? []
}

// Sem filtro "todas as empresas": o backend só lista por empresa (path param), não há
// endpoint de listagem geral — companyId é sempre obrigatório aqui
export function useAgentScopes(companyId?: string) {
    const queryClient = useQueryClient()

    const { data: scopes = [], isLoading: loading } = useQuery({
        queryKey: ["agent-scopes", companyId],
        queryFn: () => fetchScopesRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["agent-scopes"] })

    const createMutation = useMutation({
        mutationFn: (form: AgentScopeForm) =>
            api.post("/callcenter/agents", form),
    })

    const createScope = async (form: AgentScopeForm) => {
        const id = toast.loading("Vinculando agente...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Agente vinculado à empresa", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao vincular agente"), { id })
            return false
        }
    }

    const toggleMutation = useMutation({
        mutationFn: ({
            scopeId,
            active,
        }: {
            scopeId: string
            active: boolean
        }) => api.patch(`/callcenter/agents/${scopeId}`, { active }),
    })

    const toggleScopeActive = async (scopeId: string, active: boolean) => {
        const id = toast.loading(active ? "Ativando..." : "Desativando...")
        try {
            await toggleMutation.mutateAsync({ scopeId, active })
            toast.success(active ? "Agente ativado" : "Agente desativado", {
                id,
            })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar agente"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (scopeId: string) =>
            api.delete(`/callcenter/agents/${scopeId}`),
    })

    const deleteScope = async (scopeId: string) => {
        const id = toast.loading("Removendo vínculo...")
        try {
            await deleteMutation.mutateAsync(scopeId)
            toast.success("Vínculo removido", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao remover vínculo"), { id })
            return false
        }
    }

    return {
        scopes,
        loading,
        fetchScopes: invalidate,
        createScope,
        toggleScopeActive,
        deleteScope,
    }
}
