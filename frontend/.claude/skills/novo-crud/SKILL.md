---
name: novo-crud
description: Cria hook de CRUD (hooks/use-<recurso>.ts) + página de dashboard para um recurso da API do backend, seguindo o padrão api/sonner do projeto
---

# Novo CRUD

Cria a integração completa de um recurso da API: hook em `hooks/` + página em `app/dashboard/`.

## Passos

1. **Contrato primeiro**: ler `../backend/src/modules/<recurso>/<recurso>.routes.ts` e `../backend/src/modules/<recurso>/schemas/` para extrair rotas, campos e validações. Nunca inventar shape.
2. Criar `hooks/use-<recurso>.ts` a partir do template abaixo + schemas zod espelhando o backend com mensagens customizadas em PT (ver `hooks/use-users.ts` como exemplo canônico).
3. Criar `components/<Recurso>/<recurso>-form-dialog.tsx` (react-hook-form + zodResolver + Field/FieldError) e `components/<Recurso>/<recurso>s-table.tsx` (tabela com skeleton/empty/rows).
4. Criar `app/dashboard/<recurso>/page.tsx` orquestrando: hook + estados de dialog + composição (ver `app/dashboard/users/page.tsx`).
5. Rodar `pnpm typecheck && pnpm lint`.

## Componentes genéricos (reutilizar, não recriar)

- `components/page-header.tsx` — `<PageHeader title description>{ação}</PageHeader>`
- `components/confirm-delete-dialog.tsx` — `<ConfirmDeleteDialog open onOpenChange title itemName onConfirm>` (loading interno; `onConfirm` retorna `Promise<boolean>`, fecha no sucesso)
- `components/status-badge.tsx` — `<StatusBadge status>` (active/inactive coloridos)
- `components/data-pagination.tsx` + `hooks/use-pagination.ts` — paginação client-side: `const { paginated, page, setPage, totalPages, total } = usePagination(items, 10)` → passar `paginated` para a tabela e renderizar `<DataPagination>` abaixo

## Template do hook

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { api, apiError } from "@/lib/api"

// Tipos extraídos do schema do backend — manter em sincronia
export type Extension = {
    id: string
    // ...campos do schema
    created_at?: string
    updated_at?: string
}

type ExtensionForm = {
    // ...campos do create/update schema
}

export function useExtensions() {
    const [extensions, setExtensions] = useState<Extension[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchExtensions = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/extensions")
            setExtensions(data.extensions ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar ramais"))
        } finally {
            setLoading(false)
        }
    }, [])

    const createExtension = async (form: ExtensionForm) => {
        const id = toast.loading("Criando...")
        try {
            await api.post("/extensions", form)
            toast.success("Ramal criado", { id })
            await fetchExtensions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao criar ramal"), { id })
            return false
        }
    }

    const updateExtension = async (extensionId: string, form: ExtensionForm) => {
        const id = toast.loading("Atualizando...")
        try {
            await api.put(`/extensions/${extensionId}`, form)
            toast.success("Ramal atualizado", { id })
            await fetchExtensions()
            return true
        } catch (err) {
            toast.error(apiError(err, "Erro ao atualizar ramal"), { id })
            return false
        }
    }

    const deleteExtension = async (extensionId: string) => {
        const id = toast.loading("Deletando...")
        try {
            await api.delete(`/extensions/${extensionId}`)
            toast.success("Ramal deletado", { id })
            setExtensions((prev) => prev.filter((e) => e.id !== extensionId))
        } catch (err) {
            toast.error(apiError(err, "Erro ao deletar ramal"), { id })
        }
    }

    const filtered = extensions.filter((e) =>
        JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()),
    )

    useEffect(() => {
        fetchExtensions()
    }, [fetchExtensions])

    return {
        extensions: filtered,
        loading,
        filter,
        setFilter,
        fetchExtensions,
        createExtension,
        updateExtension,
        deleteExtension,
    }
}
```

## Regras

- Nome do arquivo kebab-case (`use-time-groups.ts`), export camelCase (`useTimeGroups`)
- Resposta da API: `{ success, message, <recurso> }` — lista no plural, item no singular
- Nunca usar `axios` direto nem `fetch` — sempre `api` de `@/lib/api` (interceptors cuidam de token/refresh)
- Filtro: ajustar para os campos relevantes do recurso (o `JSON.stringify` do template é placeholder)
- Se o recurso tiver rotas extras (ex: `/extensions/batch`), expor funções adicionais no mesmo hook
