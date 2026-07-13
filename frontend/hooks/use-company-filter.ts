"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "companyFilter"

/**
 * Filtro de empresa persistido em localStorage; mantém a seleção ao navegar
 * entre páginas do dashboard ou recarregar a página.
 */
export function useCompanyFilter() {
    const [companyId, setCompanyId] = useState<string | undefined>(undefined)

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setCompanyId(stored)
    }, [])

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
