"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

// Espelha INTEGRATION_PROVIDERS de backend/src/modules/integration-credentials/schemas/integration-credential.schema.ts —
// cresce a cada integração nova, sem precisar de um hook/model por provedor
export const INTEGRATION_PROVIDERS = ["ixc"] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
    ixc: "IXCsoft",
}

export type IntegrationCredential = {
    id: string
    provider: IntegrationProvider
    name: string
    companyId: string
    baseUrl: string
    createdAt: string
    updatedAt: string
}

// token nunca volta em GET (write-only); em edição, campo vazio = mantém o token atual
export const createIntegrationCredentialFormSchema = z.object({
    provider: z.enum(INTEGRATION_PROVIDERS),
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    baseUrl: z.string().url("Informe uma URL válida").max(255, "Máximo 255 caracteres"),
    token: z.string().min(1, "Informe o token").max(500, "Máximo 500 caracteres"),
})

export const updateIntegrationCredentialFormSchema = createIntegrationCredentialFormSchema
    .omit({ companyId: true, provider: true })
    .extend({ token: z.string().max(500, "Máximo 500 caracteres") })

export type IntegrationCredentialForm = z.infer<typeof createIntegrationCredentialFormSchema>
export type IntegrationCredentialUpdateForm = z.infer<typeof updateIntegrationCredentialFormSchema>

function toPayload(form: IntegrationCredentialUpdateForm) {
    return {
        name: form.name,
        baseUrl: form.baseUrl,
        token: form.token.trim() ? form.token : undefined,
    }
}

async function fetchIntegrationCredentialsRequest(companyId: string, provider?: IntegrationProvider): Promise<IntegrationCredential[]> {
    const { data } = await api.get("/integration-credentials", { params: { companyId, provider } })
    return data.integrationCredentials ?? []
}

// provider opcional filtra a lista no backend (ex: o form do nó IXCsoft só quer credenciais provider="ixc")
export function useIntegrationCredentials(companyId?: string, provider?: IntegrationProvider) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: integrationCredentials = [], isLoading: loading } = useQuery({
        queryKey: ["integration-credentials", companyId, provider],
        queryFn: () => fetchIntegrationCredentialsRequest(companyId as string, provider),
        enabled: !!companyId,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["integration-credentials"] })

    const createMutation = useMutation({
        mutationFn: ({ form, targetCompanyId }: { form: IntegrationCredentialForm; targetCompanyId: string }) =>
            api.post("/integration-credentials", { ...toPayload(form), provider: form.provider, companyId: targetCompanyId }),
    })

    async function createIntegrationCredential(form: IntegrationCredentialForm, targetCompanyId: string): Promise<boolean>
    async function createIntegrationCredential(form: IntegrationCredentialForm, targetCompanyId: string, withResourceId: true): Promise<string | null>
    async function createIntegrationCredential(form: IntegrationCredentialForm, targetCompanyId: string, withResourceId = false) {
        const id = toast.loading("Criando credencial...")
        try {
            const { data } = await createMutation.mutateAsync({ form, targetCompanyId })
            toast.success("Credencial criada", { id })
            await invalidate()
            return withResourceId ? (data.integrationCredentialId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar credencial"), { id })
            return withResourceId ? null : false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({ integrationCredentialId, form }: { integrationCredentialId: string; form: IntegrationCredentialUpdateForm }) =>
            api.put(`/integration-credentials/${integrationCredentialId}`, toPayload(form)),
    })

    const updateIntegrationCredential = async (integrationCredentialId: string, form: IntegrationCredentialUpdateForm) => {
        const id = toast.loading("Atualizando credencial...")
        try {
            await updateMutation.mutateAsync({ integrationCredentialId, form })
            toast.success("Credencial atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar credencial"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (integrationCredentialId: string) => api.delete(`/integration-credentials/${integrationCredentialId}`),
    })

    const deleteIntegrationCredential = async (integrationCredentialId: string) => {
        const id = toast.loading("Deletando credencial...")
        try {
            await deleteMutation.mutateAsync(integrationCredentialId)
            toast.success("Credencial deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar credencial"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () => integrationCredentials.filter((c) => `${c.name} ${c.baseUrl}`.toLowerCase().includes(filter.toLowerCase())),
        [integrationCredentials, filter]
    )

    return {
        integrationCredentials: filtered,
        loading,
        filter,
        setFilter,
        fetchIntegrationCredentials: invalidate,
        createIntegrationCredential,
        updateIntegrationCredential,
        deleteIntegrationCredential,
    }
}
