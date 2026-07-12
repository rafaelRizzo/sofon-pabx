"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"
import { routeDestinationSchema, type RouteDestination } from "@/components/RouteDestination/route-destination-field"

export type Assignment = { variable: string; value: string }

export type VariableSet = {
    id: string
    name: string
    companyId: string
    assignments: Assignment[]
    destination: RouteDestination
    createdAt: string
    updatedAt: string
}

// Espelha assignmentSchema de backend/src/modules/variables/schemas/variable.schema.ts
const assignmentFieldSchema = z.object({
    variable: z
        .string()
        .min(1, "Informe a variável")
        .max(80, "Máximo 80 caracteres")
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letras, dígitos e _ (começando com letra ou _)"),
    value: z
        .string()
        .max(500, "Máximo 500 caracteres")
        .regex(/^[^"\\]*$/, "Não pode conter aspas duplas ou barra invertida"),
})

// Espelha create/updateVariableSetSchema de backend/src/modules/variables/schemas/variable.schema.ts —
// companyId só existe no create, o PATCH do backend não permite trocar empresa
export const createVariableSetFormSchema = z.object({
    name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
    companyId: z.string().min(1, "Selecione uma empresa"),
    assignments: z.array(assignmentFieldSchema).min(1, "Adicione ao menos uma atribuição").max(20, "Máximo 20 atribuições"),
    destination: routeDestinationSchema,
})

export const updateVariableSetFormSchema = createVariableSetFormSchema.omit({ companyId: true })

export type VariableSetForm = z.infer<typeof createVariableSetFormSchema>
export type VariableSetUpdateForm = z.infer<typeof updateVariableSetFormSchema>

// companyId opcional — omitido, busca todas as variáveis no escopo do usuário, permitindo o
// filtro "Todas as empresas" na página
export function useVariables(companyId?: string) {
    const [variableSets, setVariableSets] = useState<VariableSet[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchVariableSets = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/variables", {
                params: companyId ? { companyId } : undefined,
            })
            setVariableSets(data.variableSets ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar variáveis"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

    // companyId da variável vem do próprio form (campo "Empresa" do dialog), não do filtro da página
    const createVariableSet = async (form: VariableSetForm) => {
        const id = toast.loading("Criando variável...")
        try {
            await api.post("/variables", form)
            toast.success("Variável criada", { id })
            await fetchVariableSets()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar variável"), { id })
            return false
        }
    }

    const updateVariableSet = async (variableSetId: string, form: VariableSetUpdateForm) => {
        const id = toast.loading("Atualizando variável...")
        try {
            await api.patch(`/variables/${variableSetId}`, form)
            toast.success("Variável atualizada", { id })
            await fetchVariableSets()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar variável"), { id })
            return false
        }
    }

    const deleteVariableSet = async (variableSetId: string) => {
        const id = toast.loading("Deletando variável...")
        try {
            await api.delete(`/variables/${variableSetId}`)
            toast.success("Variável deletada", { id })
            await fetchVariableSets()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar variável"), { id })
            return false
        }
    }

    const filtered = variableSets.filter((v) =>
        v.name.toLowerCase().includes(filter.toLowerCase())
    )

    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchVariableSets()
    }, [fetchVariableSets, companyId])

    return {
        variableSets: filtered,
        loading,
        filter,
        setFilter,
        fetchVariableSets,
        createVariableSet,
        updateVariableSet,
        deleteVariableSet,
    }
}
