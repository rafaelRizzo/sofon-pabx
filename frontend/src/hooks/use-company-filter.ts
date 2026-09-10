"use client"

import { useEffect, useState } from "react"

import { useCompanies } from "@/hooks/use-companies"

const STORAGE_KEY = "companyFilter"

/**
 * Filtro de empresa persistido em localStorage; mantém a seleção ao navegar
 * entre páginas do dashboard ou recarregar a página.
 */
export function useCompanyFilter() {
    // lazy initializer: restaura sincronamente no primeiro render, evitando
    // que um useEffect concorrente (ex: auto-seleção da primeira empresa em
    // dashboard/index.tsx) veja companyId undefined e sobrescreva a seleção
    // salva antes do restore assíncrono acontecer
    const [companyId, setCompanyId] = useState<string | undefined>(
        () => localStorage.getItem(STORAGE_KEY) ?? undefined,
    )
    const { companies, loading } = useCompanies()

    // limpa seleção persistida que não existe mais (empresa deletada ou sem acesso desde a
    // última sessão) - sem isso o companyId stale seguia sendo usado nos fetches e dava 404
    useEffect(() => {
        if (loading || !companyId) return
        if (!companies.some((c) => c.id === companyId)) {
            setCompanyId(undefined)
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [companies, loading, companyId])

    const setCompanyFilter = (id: string | undefined) => {
        setCompanyId(id)
        if (id) {
            localStorage.setItem(STORAGE_KEY, id)
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }

    return [companyId, setCompanyFilter] as const
}
