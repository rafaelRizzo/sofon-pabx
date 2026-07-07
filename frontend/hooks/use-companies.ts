"use client"

import { useCallback, useEffect, useState } from "react"
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
    createdAt: string
    updatedAt: string
}

// Espelha create/updateCompanySchema do backend.
// metadata é array no form (useFieldArray) e vira Record no payload;
// userId só é aceito no create (vincula a empresa a um usuário dono).
export const companyFormSchema = z.object({
    name: z.string().min(1, "Informe o nome"),
    doc: z.string().optional(),
    status: z.enum(["active", "inactive", "blocked"], "Selecione um status"),
    timezone: z.string().min(1, "Selecione um fuso horário"),
    userId: z.string().optional(),
    metadata: z.array(
        z.object({
            key: z.string().min(1, "Informe a chave"),
            value: z.string().min(1, "Informe o valor"),
        })
    ),
})

export type CompanyForm = z.infer<typeof companyFormSchema>

const toMetadataRecord = (metadata: CompanyForm["metadata"]) =>
    Object.fromEntries(metadata.map((m) => [m.key, m.value]))

export function useCompanies() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchCompanies = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/companies")
            setCompanies(data.companies ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar empresas"))
        } finally {
            setLoading(false)
        }
    }, [])

    const createCompany = async (form: CompanyForm) => {
        const id = toast.loading("Criando empresa...")
        try {
            await api.post("/companies", {
                ...form,
                doc: form.doc || undefined,
                status: undefined, // status só faz sentido no edit (default active)
                userId: form.userId || undefined,
                metadata: toMetadataRecord(form.metadata),
            })
            toast.success("Empresa criada", { id })
            await fetchCompanies()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar empresa"), { id })
            return false
        }
    }

    const updateCompany = async (companyId: string, form: CompanyForm) => {
        const id = toast.loading("Atualizando empresa...")
        try {
            await api.put(`/companies/${companyId}`, {
                name: form.name,
                doc: form.doc || undefined,
                status: form.status,
                timezone: form.timezone,
                userId: form.userId || undefined,
                metadata: toMetadataRecord(form.metadata),
            })
            toast.success("Empresa atualizada", { id })
            await fetchCompanies()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar empresa"), { id })
            return false
        }
    }

    const deleteCompany = async (companyId: string) => {
        const id = toast.loading("Deletando empresa...")
        try {
            await api.delete(`/companies/${companyId}`)
            toast.success("Empresa deletada", { id })
            await fetchCompanies()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar empresa"), { id })
            return false
        }
    }

    const filtered = companies.filter((c) =>
        `${c.name} ${c.doc ?? ""}`.toLowerCase().includes(filter.toLowerCase())
    )

    useEffect(() => {
        fetchCompanies()
    }, [fetchCompanies])

    return {
        companies: filtered,
        loading,
        filter,
        setFilter,
        fetchCompanies,
        createCompany,
        updateCompany,
        deleteCompany,
    }
}
