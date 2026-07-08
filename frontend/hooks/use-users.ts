"use client"

import { useCallback, useEffect, useState } from "react"
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

export function useUsers() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/users")
            setUsers(data.users ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar usuários"))
        } finally {
            setLoading(false)
        }
    }, [])

    const createUser = async (form: CreateUserForm) => {
        const id = toast.loading("Criando usuário...")
        try {
            await api.post("/users", form)
            toast.success("Usuário criado", { id })
            await fetchUsers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar usuário"), { id })
            return false
        }
    }

    const updateUser = async (userId: string, form: UpdateUserForm) => {
        const id = toast.loading("Atualizando usuário...")
        try {
            await api.put(`/users/${userId}`, {
                name: form.name,
                username: form.username,
                password: form.password || undefined,
            })
            toast.success("Usuário atualizado", { id })
            await fetchUsers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar usuário"), { id })
            return false
        }
    }

    const deleteUser = async (userId: string) => {
        const id = toast.loading("Deletando usuário...")
        try {
            await api.delete(`/users/${userId}`)
            toast.success("Usuário deletado", { id })
            await fetchUsers()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar usuário"), { id })
            return false
        }
    }

    const filtered = users.filter((u) =>
        `${u.name} ${u.username}`.toLowerCase().includes(filter.toLowerCase())
    )

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    return {
        users: filtered,
        loading,
        filter,
        setFilter,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser,
    }
}
