"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { type RouteDestination } from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

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
    // não são mais editáveis por aqui — só via arrastar uma conexão no canvas do Flow (ver
    // flow-canvas.tsx), que grava direto no FlowEdge por PUT separado. Mantidos no tipo só porque a
    // API ainda devolve os campos (label resolvido, usado em telas de leitura)
    onSuccess: RouteDestination
    onError: RouteDestination
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

const optNumberRange = (min: number, max: number) =>
    z.preprocess(
        (v) =>
            v === "" || v === undefined || v === null ? undefined : Number(v),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

const headerFieldSchema = z.object({
    key: z.string().min(1, "Informe a chave").max(200, "Máximo 200 caracteres"),
    value: z
        .string()
        .min(1, "Informe o valor")
        .max(2000, "Máximo 2000 caracteres"),
})

// Espelha variableMappingSchema de backend/src/modules/request-templates/schemas/request-template.schema.ts
const variableMappingFieldSchema = z.object({
    path: z
        .string()
        .min(1, "Informe o caminho")
        .max(200, "Máximo 200 caracteres"),
    variable: z
        .string()
        .min(1, "Informe a variável")
        .max(80, "Máximo 80 caracteres")
        .regex(
            /^[A-Za-z_][A-Za-z0-9_]*$/,
            "Use letras, dígitos e _ (começando com letra ou _)"
        ),
})

// body é digitado como JSON cru no textarea — validado aqui, convertido pra objeto só no payload
const bodyFieldSchema = z
    .string()
    .max(20000, "Máximo 20000 caracteres")
    .refine((v) => {
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
    variableMappings: z
        .array(variableMappingFieldSchema)
        .max(20, "Máximo 20 mapeamentos"),
})

export const updateRequestTemplateFormSchema =
    createRequestTemplateFormSchema.omit({ companyId: true })

export type RequestTemplateForm = z.infer<
    typeof createRequestTemplateFormSchema
>
export type RequestTemplateUpdateForm = z.infer<
    typeof updateRequestTemplateFormSchema
>

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
        body: form.body.trim()
            ? JSON.parse(form.body)
            : isEdit
              ? null
              : undefined,
        variableMappings: form.variableMappings,
    }
}

// companyId opcional — enquanto não informado, a lista não é buscada (filtro de
// empresa da página exige seleção antes de consultar o backend)
export function useRequestTemplates(companyId?: string) {
    const [requestTemplates, setRequestTemplates] = useState<RequestTemplate[]>(
        []
    )
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchRequestTemplates = useCallback(async () => {
        if (!companyId) {
            setRequestTemplates([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await api.get("/request-templates", {
                params: { companyId },
            })
            setRequestTemplates(data.requestTemplates ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar templates de requisição"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId do template vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    async function createRequestTemplate(
        form: RequestTemplateForm,
        targetCompanyId: string
    ): Promise<boolean>
    async function createRequestTemplate(
        form: RequestTemplateForm,
        targetCompanyId: string,
        withResourceId: true
    ): Promise<string | null>
    async function createRequestTemplate(
        form: RequestTemplateForm,
        targetCompanyId: string,
        withResourceId = false
    ) {
        const id = toast.loading("Criando template de requisição...")
        try {
            const { data } = await api.post("/request-templates", {
                ...toPayload(form, false),
                companyId: targetCompanyId,
            })
            toast.success("Template de requisição criado", { id })
            await fetchRequestTemplates()
            return withResourceId ? (data.requestTemplateId as string) : true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar template de requisição"), {
                id,
            })
            return withResourceId ? null : false
        }
    }

    const updateRequestTemplate = async (
        requestTemplateId: string,
        form: RequestTemplateUpdateForm
    ) => {
        const id = toast.loading("Atualizando template de requisição...")
        try {
            await api.put(
                `/request-templates/${requestTemplateId}`,
                toPayload(form, true)
            )
            toast.success("Template de requisição atualizado", { id })
            await fetchRequestTemplates()
            return true
        } catch (err) {
            toast.error(
                apiError(err, "Erro ao atualizar template de requisição"),
                { id }
            )
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
            toast.error(
                apiError(err, "Erro ao deletar template de requisição"),
                { id }
            )
            return false
        }
    }

    const filtered = requestTemplates.filter((rt) =>
        `${rt.name} ${rt.url}`.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({
        fetched: false,
    })

    useEffect(() => {
        if (
            fetchStateRef.current.fetched &&
            fetchStateRef.current.key === companyId
        )
            return
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
