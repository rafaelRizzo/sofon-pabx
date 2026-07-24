"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import {
    routeDestinationSchema,
    type RouteDestination,
} from "@/components/RouteDestination/route-destination-field"
import type { UsedByRef } from "@/components/RouteDestination/used-by-badge"

export type IvrOption = {
    id: string
    digit: string
    destination: RouteDestination
}

export const IVR_MENU_TYPES = ["menu", "collect"] as const
export type IvrMenuType = (typeof IVR_MENU_TYPES)[number]

export type IvrMenu = {
    id: string
    name: string
    companyId: string
    type: IvrMenuType
    variableName: string | null
    audioId: string | null
    hasAudio: boolean
    maxDigits: number
    digitTimeout: number
    invalidRetries: number
    invalidDestination: RouteDestination
    timeoutRetries: number
    timeoutDestination: RouteDestination
    longDestination: RouteDestination
    options: IvrOption[]
    usedBy: UsedByRef[]
    createdAt: string
    updatedAt: string
}

const intField = (min: number, max: number) =>
    z.preprocess(
        (v) =>
            v === "" || v === undefined || v === null ? undefined : Number(v),
        z.number().int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)
    )

const ivrOptionFormSchema = z.object({
    digit: z.string().regex(/^[0-9]$/, "Dígito deve ser 0-9"),
    destination: routeDestinationSchema,
})

const ivrOptionsFormSchema = z
    .array(ivrOptionFormSchema)
    .max(10, "Máximo 10 opções")
    .refine((opts) => new Set(opts.map((o) => o.digit)).size === opts.length, {
        message: "Dígito duplicado entre as opções",
    })

// variáveis internas da state machine do backend (ver ivr.repository.ts), bloqueadas aqui só
// pra dar feedback mais cedo: o backend também valida isso
const RESERVED_IVR_VARIABLES = ["IVR_DIGITS", "__IVR_INV", "__IVR_TMO"]

const variableNameSchema = z
    .string()
    .min(1, "Informe o nome da variável")
    .max(80, "Máximo 80 caracteres")
    .regex(
        /^[A-Za-z_][A-Za-z0-9_]*$/,
        "Use letras, números e _, começando com letra ou _"
    )
    .refine(
        (v) => !RESERVED_IVR_VARIABLES.includes(v),
        "Nome reservado pelo sistema"
    )

// Espelha create/updateIvrMenuSchema de backend/src/modules/ivr/schemas/ivr.schema.ts:
// companyId só existe no create, o PUT do backend não permite trocar a empresa da URA. A
// consistência type/variableName/options/maxDigits vale nos dois casos, por isso o superRefine
// é aplicado depois do .omit() em cada schema (não dá pra .omit() depois de .superRefine())
const ivrMenuBaseFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    type: z.enum(IVR_MENU_TYPES),
    // só usado quando type="collect": expõe os dígitos coletados nessa variável de canal
    variableName: z.string().nullable(),
    audioId: z.string().nullable(),
    maxDigits: intField(1, 20),
    digitTimeout: intField(1, 60),
    invalidRetries: intField(0, 10),
    invalidDestination: routeDestinationSchema,
    timeoutRetries: intField(0, 10),
    timeoutDestination: routeDestinationSchema,
    longDestination: routeDestinationSchema,
    options: ivrOptionsFormSchema,
})

type TypeConsistencyFields = {
    type: IvrMenuType
    variableName: string | null
    maxDigits: number
    options: unknown[]
}

function checkTypeConsistency(
    data: TypeConsistencyFields,
    ctx: z.RefinementCtx
) {
    if (data.type === "collect") {
        if (!data.variableName) {
            ctx.addIssue({
                code: "custom",
                path: ["variableName"],
                message: "Informe o nome da variável",
            })
        } else {
            const parsed = variableNameSchema.safeParse(data.variableName)
            if (!parsed.success) {
                ctx.addIssue({
                    code: "custom",
                    path: ["variableName"],
                    message: parsed.error.issues[0].message,
                })
            }
        }
        if (data.options.length > 0) {
            ctx.addIssue({
                code: "custom",
                path: ["options"],
                message: "Coleta de dígitos não tem opções de tecla",
            })
        }
        if (data.maxDigits < 2) {
            ctx.addIssue({
                code: "custom",
                path: ["maxDigits"],
                message: "Mínimo 2 dígitos para coleta",
            })
        }
    } else if (data.variableName) {
        ctx.addIssue({
            code: "custom",
            path: ["variableName"],
            message: "Nome de variável só se aplica ao tipo coleta",
        })
    }
}

export const createIvrMenuFormSchema =
    ivrMenuBaseFormSchema.superRefine(checkTypeConsistency)
export const updateIvrMenuFormSchema = ivrMenuBaseFormSchema
    .omit({ companyId: true })
    .superRefine(checkTypeConsistency)

export type IvrMenuForm = z.infer<typeof createIvrMenuFormSchema>
export type IvrMenuUpdateForm = z.infer<typeof updateIvrMenuFormSchema>

// audioId: create do backend não aceita null (só cuid2 ou ausente), update aceita null pra desvincular.
// variableName: create não aceita null (só string ou ausente); update aceita null pra limpar ao
// voltar de "collect" pra "menu", por isso sempre manda null explícito quando type !== "collect"
const toCreatePayload = (form: IvrMenuForm, targetCompanyId: string) => ({
    name: form.name,
    companyId: targetCompanyId,
    type: form.type,
    variableName: form.type === "collect" ? form.variableName : undefined,
    audioId: form.audioId ?? undefined,
    maxDigits: form.maxDigits,
    digitTimeout: form.digitTimeout,
    invalidRetries: form.invalidRetries,
    invalidDestination: form.invalidDestination,
    timeoutRetries: form.timeoutRetries,
    timeoutDestination: form.timeoutDestination,
    longDestination: form.longDestination,
    options: form.options,
})

const toUpdatePayload = (form: IvrMenuUpdateForm) => ({
    name: form.name,
    type: form.type,
    variableName: form.type === "collect" ? form.variableName : null,
    audioId: form.audioId,
    maxDigits: form.maxDigits,
    digitTimeout: form.digitTimeout,
    invalidRetries: form.invalidRetries,
    invalidDestination: form.invalidDestination,
    timeoutRetries: form.timeoutRetries,
    timeoutDestination: form.timeoutDestination,
    longDestination: form.longDestination,
    options: form.options,
})

// companyId opcional: enquanto não informado, a lista não é buscada (filtro de empresa
// da página exige seleção antes de consultar o backend). Diferente da empresa do formulário
// de criação (que é passada explicitamente para createIvrMenu, pois pode divergir deste
// filtro ao editar uma URA específica)
async function fetchIvrMenusRequest(companyId: string): Promise<IvrMenu[]> {
    const { data } = await api.get("/ivr-menus", { params: { companyId } })
    return data.ivrMenus ?? []
}

// Referência estável enquanto a query ainda não resolveu (undefined) — um array literal `[]`
// como default do destructuring recria a cada render, o que quebra useMemo/useEffect que
// dependem de `allIvrMenus` (ver ivrById em flow-canvas.tsx) e causa loop de re-render
// ("Maximum update depth exceeded") enquanto a query está loading/disabled.
const EMPTY_IVR_MENUS: IvrMenu[] = []

export function useIvr(companyId?: string) {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: ivrMenus = EMPTY_IVR_MENUS, isLoading: loading } = useQuery({
        queryKey: ["ivr-menus", companyId],
        queryFn: () => fetchIvrMenusRequest(companyId as string),
        enabled: !!companyId,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["ivr-menus"] })

    const createMutation = useMutation({
        mutationFn: ({
            form,
            targetCompanyId,
        }: {
            form: IvrMenuForm
            targetCompanyId: string
        }) => api.post("/ivr-menus", toCreatePayload(form, targetCompanyId)),
    })

    const createIvrMenu = async (
        form: IvrMenuForm,
        targetCompanyId: string
    ) => {
        const id = toast.loading("Criando menu de URA...")
        try {
            const { data } = await createMutation.mutateAsync({
                form,
                targetCompanyId,
            })
            toast.success("Menu de URA criado", { id })
            await invalidate()
            return data.ivrMenuId as string
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar menu de URA"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            ivrMenuId,
            form,
        }: {
            ivrMenuId: string
            form: IvrMenuUpdateForm
        }) => api.put(`/ivr-menus/${ivrMenuId}`, toUpdatePayload(form)),
    })

    const updateIvrMenu = async (
        ivrMenuId: string,
        form: IvrMenuUpdateForm
    ) => {
        const id = toast.loading("Atualizando menu de URA...")
        try {
            await updateMutation.mutateAsync({ ivrMenuId, form })
            toast.success("Menu de URA atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar menu de URA"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (ivrMenuId: string) =>
            api.delete(`/ivr-menus/${ivrMenuId}`),
    })

    const deleteIvrMenu = async (ivrMenuId: string) => {
        const id = toast.loading("Deletando menu de URA...")
        try {
            await deleteMutation.mutateAsync(ivrMenuId)
            toast.success("Menu de URA deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar menu de URA"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            ivrMenus.filter((m) =>
                m.name.toLowerCase().includes(filter.toLowerCase())
            ),
        [ivrMenus, filter]
    )

    return {
        ivrMenus: filtered,
        allIvrMenus: ivrMenus,
        loading,
        filter,
        setFilter,
        fetchIvrMenus: invalidate,
        createIvrMenu,
        updateIvrMenu,
        deleteIvrMenu,
    }
}
