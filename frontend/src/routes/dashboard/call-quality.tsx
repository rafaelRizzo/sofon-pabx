import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { CallQualitySummaryCards } from "@/components/CallQuality/call-quality-summary-cards"
import { CallQualityTable } from "@/components/CallQuality/call-quality-table"
import { CompanyFilter } from "@/components/company-filter"
import { DataPagination } from "@/components/data-pagination"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    useCallQualityRecords,
    useCallQualitySummary,
    type CallQualityFilters,
} from "@/hooks/use-call-quality"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useTrunks, type Trunk } from "@/hooks/use-trunks"

// "YYYY-MM-DD" -> Date local (evita o shift de fuso de "new Date(string)", que interpreta como UTC)
function parseDateOnly(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
}

function CallQualityPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    const { trunks } = useTrunks(companyId)

    const [trunkId, setTrunkId] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const filters: CallQualityFilters = {
        trunkId: trunkId !== "all" ? trunkId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    }

    const { records, total, loading, page, totalPages, goToPage } =
        useCallQualityRecords(companyId, filters, 10)
    const { summary, loading: summaryLoading } = useCallQualitySummary(
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
                title="Qualidade de rede"
                description="Jitter, perda de pacote e RTT por chamada (perna de tronco), via RTCP nativo do Asterisk"
            />

            <FilterBar>
                <CompanyFilter
                    companies={companies}
                    value={companyId}
                    onValueChange={setCompanyId}
                />
            </FilterBar>

            {companyId && (
                <>
                    <CallQualitySummaryCards
                        summary={summary}
                        loading={summaryLoading}
                    />

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                        <Combobox<Trunk>
                            items={trunks}
                            value={trunks.find((t) => t.id === trunkId) ?? null}
                            itemToStringLabel={(t) => t.name}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onValueChange={(t) => setTrunkId(t?.id ?? "all")}
                        >
                            <ComboboxInput
                                placeholder="Filtrar por tronco..."
                                className="w-full"
                            />
                            <ComboboxContent>
                                <ComboboxEmpty>Nenhum tronco</ComboboxEmpty>
                                <ComboboxList>
                                    {(t: Trunk) => (
                                        <ComboboxItem key={t.id} value={t}>
                                            {t.name}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                        <Popover>
                            <PopoverTrigger
                                render={
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start border-input! font-normal lg:col-span-2 dark:border-[#383838]!"
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
                    </div>

                    <CallQualityTable records={records} loading={loading} />

                    <DataPagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        onPageChange={goToPage}
                    />
                </>
            )}
        </div>
    )
}

export const Route = createFileRoute("/dashboard/call-quality")({
    component: CallQualityPage,
})
