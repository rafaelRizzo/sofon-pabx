"use client"

import { useMemo, useState } from "react"

export function usePagination<T>(items: T[], pageSize = 10) {
    const [page, setPage] = useState(1)

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    // clamp: se o filtro reduzir a lista, volta para a última página válida
    const current = Math.min(page, totalPages)

    const paginated = useMemo(
        () => items.slice((current - 1) * pageSize, current * pageSize),
        [items, current, pageSize]
    )

    return {
        page: current,
        setPage,
        totalPages,
        paginated,
        total: items.length,
    }
}
