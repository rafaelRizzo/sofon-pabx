import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { AuditLogTable } from "@/components/AuditLogs/audit-log-table"
import { CompanyFilter } from "@/components/company-filter"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ACTION_LABEL,
    AUDIT_LOG_MODEL_LABEL,
    AUDIT_LOG_MODELS,
    useAuditLogs,
    type AuditLogAction,
    type AuditLogFilters,
    type AuditLogModel,
} from "@/hooks/use-audit-logs"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"

// "YYYY-MM-DD" -> Date local (evita o shift de fuso de "new Date(string)", que interpreta como UTC)
function parseDateOnly(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
}

const MODEL_OPTIONS = [
    { value: "all", label: "Todos os recursos" },
    ...AUDIT_LOG_MODELS.map((m) => ({ value: m, label: AUDIT_LOG_MODEL_LABEL[m] })),
] as const

const ACTION_OPTIONS = [
    { value: "all", label: "Todas as ações" },
    { value: "CREATE", label: ACTION_LABEL.CREATE },
    { value: "UPDATE", label: ACTION_LABEL.UPDATE },
    { value: "DELETE", label: ACTION_LABEL.DELETE },
] as const

function AuditLogsPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    const [model, setModel] = useState("all")
    const [action, setAction] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const filters: AuditLogFilters = {
        model: model !== "all" ? (model as AuditLogModel) : undefined,
        action: action !== "all" ? (action as AuditLogAction) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    }

    const { records, total, loading, page, totalPages, goToPage } = useAuditLogs(
        companyId,
        filters
    )

    const dateRange: DateRange | undefined = {
        from: parseDateOnly(startDate),
        to: parseDateOnly(endDate),
    }
    const dateRangeLabel = dateRange.from
        ? dateRange.to
            ? `${format(dateRange.from, "dd/MM/yy")} – ${format(dateRange.to, "dd/MM/yy")}`
            : format(dateRange.from, "dd/MM/yy")
        : "Período"

    function handleDateRangeChange(range: DateRange | undefined) {
        setStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "")
        setEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "")
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Log de auditoria"
                description="Rastreabilidade de quem alterou o quê, quando e para qual valor"
            />

            <FilterBar>
                <CompanyFilter
                    companies={companies}
                    value={companyId}
                    onValueChange={setCompanyId}
                    showAllOption
                />
                <Select items={MODEL_OPTIONS} value={model} onValueChange={(v) => setModel(v ?? "all")}>
                    <SelectTrigger className="w-full md:w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MODEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select items={ACTION_OPTIONS} value={action} onValueChange={(v) => setAction(v ?? "all")}>
                    <SelectTrigger className="w-full md:w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ACTION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Popover>
                    <PopoverTrigger
                        render={
                            <Button
                                variant="outline"
                                className="w-full justify-start border-input! font-normal md:w-56 dark:border-[#383838]!"
                            >
                                <CalendarIcon />
                                {dateRangeLabel}
                            </Button>
                        }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="range"
                            locale={ptBR}
                            numberOfMonths={2}
                            selected={dateRange}
                            onSelect={handleDateRangeChange}
                        />
                    </PopoverContent>
                </Popover>
            </FilterBar>

            <AuditLogTable
                records={records}
                companies={companies}
                loading={loading}
                showCompanyColumn={!companyId}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={goToPage}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/audit-logs")({
    component: AuditLogsPage,
})
