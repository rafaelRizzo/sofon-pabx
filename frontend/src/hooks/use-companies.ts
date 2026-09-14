"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type CompanyStatus = "active" | "inactive" | "blocked"

export type Company = {
    id: string
    name: string
    doc: string | null
    status: CompanyStatus
    timezone: string
    metadata: Record<string, unknown>
    elevenLabsApiKey: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
}

// Espelha create/updateCompanySchema do backend. metadata é array no form (useFieldArray)
// e vira Record no payload. Vínculo empresa↔usuário é gerenciado só pela tela de Usuários.
export const companyFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(255, "Máximo 255 caracteres"),
    doc: z.string().max(20, "Máximo 20 caracteres").optional(),
    status: z.enum(["active", "inactive", "blocked"], "Selecione um status"),
    timezone: z.string().min(1, "Selecione um fuso horário"),
    metadata: z.array(
        z.object({
            key: z.string().min(1, "Informe a chave"),
            value: z.string().min(1, "Informe o valor"),
        })
    ),
    elevenLabsApiKey: z.string().max(255, "Máximo 255 caracteres").optional(),
    notes: z.string().max(10000, "Máximo de 10.000 caracteres").optional(),
})

export type CompanyForm = z.infer<typeof companyFormSchema>

const toMetadataRecord = (metadata: CompanyForm["metadata"]) =>
    Object.fromEntries(metadata.map((m) => [m.key, m.value]))

async function fetchCompaniesRequest(): Promise<Company[]> {
    const { data } = await api.get("/companies")
    return data.companies ?? []
}

// Cache compartilhado via TanStack Query - uma única lista de empresas reaproveitada por
// todas as páginas que montam useCompanies() (CompanyFilter aparece em quase toda tela),
// em vez de cada página refazer o fetch do zero ao navegar
export function useCompanies() {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: companies = [], isLoading: loading } = useQuery({
        queryKey: ["companies"],
        queryFn: fetchCompaniesRequest,
    })

    // invalida qualquer instância de useCompanies montada (não só a chamada localmente)
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["companies"] })

    const createMutation = useMutation({
        mutationFn: (form: CompanyForm) =>
            api.post("/companies", {
                ...form,
                doc: form.doc || undefined,
                status: undefined, // status só faz sentido no edit (default active)
                metadata: toMetadataRecord(form.metadata),
                elevenLabsApiKey: form.elevenLabsApiKey || undefined,
            }),
    })

    const createCompany = async (form: CompanyForm) => {
        const id = toast.loading("Criando empresa...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Empresa criada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar empresa"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            companyId,
            form,
        }: {
            companyId: string
            form: CompanyForm
        }) =>
            api.put(`/companies/${companyId}`, {
                name: form.name,
                doc: form.doc || undefined,
                status: form.status,
                timezone: form.timezone,
                metadata: toMetadataRecord(form.metadata),
                elevenLabsApiKey: form.elevenLabsApiKey || undefined,
                notes: form.notes || undefined,
            }),
    })

    const updateCompany = async (companyId: string, form: CompanyForm) => {
        const id = toast.loading("Atualizando empresa...")
        try {
            await updateMutation.mutateAsync({ companyId, form })
            toast.success("Empresa atualizada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar empresa"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (companyId: string) => api.delete(`/companies/${companyId}`),
    })

    const deleteCompany = async (companyId: string) => {
        const id = toast.loading("Deletando empresa...")
        try {
            await deleteMutation.mutateAsync(companyId)
            toast.success("Empresa deletada", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar empresa"), { id })
            return false
        }
    }

    // Regenera todo dialplan estático da empresa a partir do banco - usado quando um arquivo em
    // /etc/asterisk/dialplan-extra ficou desatualizado (ex: migração/deploy que mudou como o
    // dialplan é gerado) sem precisar salvar módulo por módulo. Requer role admin (backend).
    const resyncDialplan = async (companyId: string) => {
        const id = toast.loading("Resincronizando dialplan...")
        try {
            await api.post(`/companies/${companyId}/resync-dialplan`)
            toast.success("Dialplan resincronizado", { id })
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao resincronizar dialplan"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            companies.filter((c) =>
                `${c.name} ${c.doc ?? ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            ),
        [companies, filter]
    )

    return {
        companies: filtered,
        loading,
        filter,
        setFilter,
        fetchCompanies: invalidate,
        createCompany,
        updateCompany,
        deleteCompany,
        resyncDialplan,
    }
}
