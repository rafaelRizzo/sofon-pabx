"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { routeDestinationSchema, type RouteDestination } from "@/components/RouteDestination/route-destination-field"

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export type VariableMapping = { path: string; variable: string }

export type RequestTemplate = {
    id: string
    name: string
    companyId: string
    method: HttpMethod
    url: string
    headers: Record<string, string> | null
    body: Record<string, unknown> | null
    timeoutMs: number
    variableMappings: VariableMapping[]
    onSuccess: RouteDestination
    onError: RouteDestination
    createdAt: string
    updatedAt: string
}

const optNumberRange = (min: number, max: number) =>
    z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

const headerFieldSchema = z.object({
    key: z.string().min(1, "Informe a chave").max(200, "Máximo 200 caracteres"),
    value: z.string().min(1, "Informe o valor").max(2000, "Máximo 2000 caracteres"),
})

// Espelha variableMappingSchema de backend/src/modules/request-templates/schemas/request-template.schema.ts
const variableMappingFieldSchema = z.object({
    path: z.string().min(1, "Informe o caminho").max(200, "Máximo 200 caracteres"),
    variable: z
        .string()
        .min(1, "Informe a variável")
        .max(80, "Máximo 80 caracteres")
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letras, dígitos e _ (começando com letra ou _)"),
})

// body é digitado como JSON cru no textarea — validado aqui, convertido pra objeto só no payload
const bodyFieldSchema = z.string().max(20000, "Máximo 20000 caracteres").refine((v) => {
    if (!v.trim()) return true
    try {
        JSON.parse(v)
        return true
    } catch {
        return false
    }
}, "JSON inválido")

// Espelha create/updateRequestTemplateSchema de backend/src/modules/request-templates/schemas/request-template.schema.ts —
// companyId só existe no create, o PUT do backend não permite trocar empresa
export const createRequestTemplateFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    method: z.enum(HTTP_METHODS),
    url: z.string().min(1, "Informe a URL").max(2048, "Máximo 2048 caracteres"),
    timeoutMs: optNumberRange(500, 30000),
    headers: z.array(headerFieldSchema),
    body: bodyFieldSchema,
    variableMappings: z.array(variableMappingFieldSchema).max(20, "Máximo 20 mapeamentos"),
    onSuccess: routeDestinationSchema,
    onError: routeDestinationSchema,
})

export const updateRequestTemplateFormSchema = createRequestTemplateFormSchema.omit({ companyId: true })

export type RequestTemplateForm = z.infer<typeof createRequestTemplateFormSchema>
export type RequestTemplateUpdateForm = z.infer<typeof updateRequestTemplateFormSchema>

// headers/body vazios em edição precisam virar `null` (limpa no backend); no create, omitidos (undefined)
function toPayload(form: RequestTemplateUpdateForm, isEdit: boolean) {
    return {
        name: form.name,
        method: form.method,
        url: form.url,
        timeoutMs: form.timeoutMs,
        headers: form.headers.length
            ? Object.fromEntries(form.headers.map((h) => [h.key, h.value]))
            : isEdit
              ? null
              : undefined,
        body: form.body.trim() ? JSON.parse(form.body) : isEdit ? null : undefined,
        variableMappings: form.variableMappings,
        onSuccess: form.onSuccess,
        onError: form.onError,
    }
}

// companyId opcional — omitido, busca todos os templates no escopo do usuário, permitindo o
// filtro "Todas as empresas" na página
export function useRequestTemplates(companyId?: string) {
    const [requestTemplates, setRequestTemplates] = useState<RequestTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchRequestTemplates = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/request-templates", {
                params: companyId ? { companyId } : undefined,
            })
            setRequestTemplates(data.requestTemplates ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar templates de requisição"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId do template vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    const createRequestTemplate = async (form: RequestTemplateForm, targetCompanyId: string) => {
        const id = toast.loading("Criando template de requisição...")
        try {
            await api.post("/request-templates", {
                ...toPayload(form, false),
                companyId: targetCompanyId,
            })
            toast.success("Template de requisição criado", { id })
            await fetchRequestTemplates()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar template de requisição"), { id })
            return false
        }
    }

    const updateRequestTemplate = async (requestTemplateId: string, form: RequestTemplateUpdateForm) => {
        const id = toast.loading("Atualizando template de requisição...")
        try {
            await api.put(`/request-templates/${requestTemplateId}`, toPayload(form, true))
            toast.success("Template de requisição atualizado", { id })
            await fetchRequestTemplates()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar template de requisição"), { id })
            return false
        }
    }

    const deleteRequestTemplate = async (requestTemplateId: string) => {
        const id = toast.loading("Deletando template de requisição...")
        try {
            await api.delete(`/request-templates/${requestTemplateId}`)
            toast.success("Template de requisição deletado", { id })
            await fetchRequestTemplates()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar template de requisição"), { id })
            return false
        }
    }

    const filtered = requestTemplates.filter((rt) =>
        `${rt.name} ${rt.url}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchRequestTemplates()
    }, [fetchRequestTemplates, companyId])

    return {
        requestTemplates: filtered,
        loading,
        filter,
        setFilter,
        fetchRequestTemplates,
        createRequestTemplate,
        updateRequestTemplate,
        deleteRequestTemplate,
    }
}
