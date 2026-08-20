"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { api, apiError } from "@/lib/api"

export type UserRole = "admin" | "reseller" | "user"

export type User = {
    id: string
    name: string
    username: string
    role: UserRole
    status: string
    // relevante só quando role === "user" (admin/reseller têm acesso irrestrito)
    permissions: string[]
    extensionId: string | null
    webhookSlug: string
    createdBy: string | null
    companies: { id: string; name: string }[]
    createdAt: string
    updatedAt: string
}

// Espelham os schemas do backend (users/schemas/user.schema.ts), com mensagens customizadas
export const createUserSchema = z.object({
    name: z.string().min(1, "Informe o nome"),
    username: z.email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    role: z.enum(["admin", "reseller", "user"], "Selecione uma permissão"),
    permissions: z.array(z.string()),
    // todo usuário precisa estar vinculado a >=1 empresa (ver users.schema.ts do backend)
    companyIds: z.array(z.string()).min(1, "Selecione ao menos uma empresa"),
    // vincula o usuário a um ramal (softphone WebRTC, ver Extension.webrtc) — opcional, null = nenhum
    extensionId: z.string().nullable().optional(),
})

// Mesmo shape do create para o form; senha em branco = manter a atual.
// O role não é enviado no PUT (backend não aceita) — omitido no updateUser.
export const updateUserSchema = createUserSchema.extend({
    password: z
        .literal("")
        .or(z.string().min(6, "A senha deve ter no mínimo 6 caracteres")),
})

export type CreateUserForm = z.infer<typeof createUserSchema>
export type UpdateUserForm = z.infer<typeof updateUserSchema>

async function fetchUsersRequest(): Promise<User[]> {
    const { data } = await api.get("/users")
    return data.users ?? []
}

// Cache compartilhado via TanStack Query — mesma ideia de useCompanies()
export function useUsers() {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState("")

    const { data: users = [], isLoading: loading } = useQuery({
        queryKey: ["users"],
        queryFn: fetchUsersRequest,
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["users"] })

    const createMutation = useMutation({
        mutationFn: (form: CreateUserForm) => api.post("/users", form),
    })

    const createUser = async (form: CreateUserForm) => {
        const id = toast.loading("Criando usuário...")
        try {
            await createMutation.mutateAsync(form)
            toast.success("Usuário criado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar usuário"), { id })
            return false
        }
    }

    const updateMutation = useMutation({
        mutationFn: ({
            userId,
            form,
        }: {
            userId: string
            form: UpdateUserForm
        }) =>
            api.put(`/users/${userId}`, {
                name: form.name,
                username: form.username,
                password: form.password || undefined,
                // só admin altera; backend rejeita 403 se um "user" tentar (ver users.controller.ts)
                permissions: form.permissions,
                companyIds: form.companyIds,
                extensionId: form.extensionId ?? null,
            }),
    })

    const updateUser = async (userId: string, form: UpdateUserForm) => {
        const id = toast.loading("Atualizando usuário...")
        try {
            await updateMutation.mutateAsync({ userId, form })
            toast.success("Usuário atualizado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar usuário"), { id })
            return false
        }
    }

    const deleteMutation = useMutation({
        mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    })

    const deleteUser = async (userId: string) => {
        const id = toast.loading("Deletando usuário...")
        try {
            await deleteMutation.mutateAsync(userId)
            toast.success("Usuário deletado", { id })
            await invalidate()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar usuário"), { id })
            return false
        }
    }

    const filtered = useMemo(
        () =>
            users.filter((u) =>
                `${u.name} ${u.username}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            ),
        [users, filter]
    )

    return {
        users: filtered,
        loading,
        filter,
        setFilter,
        fetchUsers: invalidate,
        createUser,
        updateUser,
        deleteUser,
    }
}
