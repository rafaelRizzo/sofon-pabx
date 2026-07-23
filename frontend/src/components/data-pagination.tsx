"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type DataPaginationProps = {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
}

export function DataPagination({
    page,
    totalPages,
    total,
    onPageChange,
}: DataPaginationProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
                {total} {total === 1 ? "registro" : "registros"}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeftIcon />
                    <span className="sr-only">Página anterior</span>
                </Button>
                <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRightIcon />
                    <span className="sr-only">Próxima página</span>
                </Button>
            </div>
        </div>
    )
}
