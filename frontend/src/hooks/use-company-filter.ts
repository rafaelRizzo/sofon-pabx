"use client"

import { useEffect, useState } from "react"

import { useCompanies } from "@/hooks/use-companies"

const STORAGE_KEY = "companyFilter"

/**
 * Filtro de empresa persistido em localStorage; mantém a seleção ao navegar
 * entre páginas do dashboard ou recarregar a página.
 */
export function useCompanyFilter() {
    const [companyId, setCompanyId] = useState<string | undefined>(undefined)
    const { companies, loading } = useCompanies()

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setCompanyId(stored)
    }, [])

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
