---
name: novo-crud
description: Cria hook de CRUD (hooks/use-<recurso>.ts) + página de dashboard para um recurso da API do backend, seguindo o padrão api/sonner do projeto
---

# Novo CRUD

Cria a integração completa de um recurso da API: hook em `hooks/` + página em `app/dashboard/`.

## Passos

1. **Contrato primeiro**: ler `../backend/src/modules/<recurso>/<recurso>.routes.ts` e `../backend/src/modules/<recurso>/schemas/` para extrair rotas, campos e validações. Nunca inventar shape. Checar se o `GET` de listagem já aceita `companyId` como query param opcional (padrão `optionalCompanyQuery` no backend — ver `queues.routes.ts`/`dids.routes.ts` como referência). Se o recurso tem filtro por empresa na página e o backend ainda não suporta, adicionar lá primeiro (schema de query + `req.scope.assertAccess(companyId)` no controller + filtro no service) — nunca filtrar por empresa só no client.
2. Criar `hooks/use-<recurso>.ts` a partir do template abaixo + schemas zod espelhando o backend com mensagens customizadas em PT (ver `hooks/use-dids.ts`/`hooks/use-queues.ts` como exemplo canônico do padrão fetch-by-company).
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

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { api, apiError } from "@/lib/api"

// Tipos extraídos do schema do backend — manter em sincronia
export type Extension = {
    id: string
    // ...campos do schema
    companyId: string
    createdAt: string
    updatedAt: string
}

type ExtensionForm = {
    // ...campos do create/update schema
}

// companyId opcional — omitido, busca todos os registros no escopo do usuário, permitindo o
// filtro "Todas as empresas" na página. Ao trocar de empresa, o hook refaz o GET com
// ?companyId=<id> — nunca filtrar a lista já carregada no client (ver hooks/use-dids.ts)
export function useExtensions(companyId?: string) {
    const [extensions, setExtensions] = useState<Extension[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    const fetchExtensions = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await api.get("/extensions", {
                params: companyId ? { companyId } : undefined,
            })
            setExtensions(data.extensions ?? [])
        } catch (err) {
            toast.error(apiError(err, "Erro ao buscar ramais"))
        } finally {
            setLoading(false)
        }
    }, [companyId])

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

    // fetchStateRef evita refetch em toda re-render, mas refaz quando companyId muda
    const fetchStateRef = useRef<{ key?: string; fetched: boolean }>({ fetched: false })

    useEffect(() => {
        if (fetchStateRef.current.fetched && fetchStateRef.current.key === companyId) return
        fetchStateRef.current = { key: companyId, fetched: true }
        fetchExtensions()
    }, [fetchExtensions, companyId])

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

Na página, o `Combobox` de empresa dirige o próprio GET — não faz `.filter()` sobre uma lista já carregada:

```tsx
const [companyFilter, setCompanyFilter] = useState<string>("all")
const { extensions, ... } = useExtensions(companyFilter === "all" ? undefined : companyFilter)
```

## Regras

- Nome do arquivo kebab-case (`use-time-groups.ts`), export camelCase (`useTimeGroups`)
- Resposta da API: `{ success, message, <recurso> }` — lista no plural, item no singular
- Nunca usar `axios` direto nem `fetch` — sempre `api` de `@/lib/api` (interceptors cuidam de token/refresh)
- Filtro: ajustar para os campos relevantes do recurso (o `JSON.stringify` do template é placeholder)
- Filtro por empresa é **sempre** fetch-by-company (query param `companyId`, refetch no `useEffect` quando muda), nunca `.filter()` client-side sobre a lista inteira — padrão único em todos os CRUDs do projeto
- Se o recurso tiver rotas extras (ex: `/extensions/batch`), expor funções adicionais no mesmo hook
