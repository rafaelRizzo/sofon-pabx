import { createFileRoute } from "@tanstack/react-router"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { CompanyFilter } from "@/components/company-filter"
import { CdrMetricsCards } from "@/components/Cdr/cdr-metrics-cards"
import { CdrTable } from "@/components/Cdr/cdr-table"
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
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCdrMetrics, useCdrRecords, type CdrFilters } from "@/hooks/use-cdr"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useExtensions, type Extension } from "@/hooks/use-extensions"
import { useQueues, type Queue } from "@/hooks/use-queues"
import { useTrunks, type Trunk } from "@/hooks/use-trunks"

// "YYYY-MM-DD" -> Date local (evita o shift de fuso de "new Date(string)", que interpreta como UTC)
function parseDateOnly(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
}

const DIRECTION_OPTIONS = [
    { value: "all", label: "Todos os tipos" },
    { value: "inbound", label: "Entrada" },
    { value: "outbound", label: "Saída" },
    { value: "internal", label: "Interna" },
] as const

const STATUS_OPTIONS = [
    { value: "all", label: "Todos os status" },
    { value: "ANSWERED", label: "Atendida" },
    { value: "NO ANSWER", label: "Não atendida" },
    { value: "BUSY", label: "Ocupado" },
    { value: "FAILED", label: "Falha" },
    { value: "CONGESTION", label: "Congestionamento" },
] as const

function CdrPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    const { extensions } = useExtensions(companyId)
    const { trunks } = useTrunks(companyId)
    const { queues } = useQueues(companyId)

    // originExtension é o alias/número do ramal (CALLERID(num) setado via dialplan), não o id do registro
    const [extensionAlias, setExtensionAlias] = useState("")
    // src/dst: colunas nativas do Asterisk, sempre preenchidas — diferente de originExtension/dialedNumber,
    // que só existem quando a chamada passa pelo dialplan enriquecido (ver use-cdr.ts)
    const [src, setSrc] = useState("")
    const [dst, setDst] = useState("")
    const [direction, setDirection] = useState("all")
    const [callStatus, setCallStatus] = useState("all")
    const [trunkId, setTrunkId] = useState("all")
    const [queueId, setQueueId] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const filters: CdrFilters = {
        originExtension: extensionAlias || undefined,
        src: src || undefined,
        dst: dst || undefined,
        direction: direction !== "all" ? (direction as CdrFilters["direction"]) : undefined,
        callStatus: callStatus !== "all" ? (callStatus as CdrFilters["callStatus"]) : undefined,
        trunkId: trunkId !== "all" ? trunkId : undefined,
        queueId: queueId !== "all" ? queueId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    }

    const {
        records,
        total,
        loading,
        page,
        totalPages,
        goNext,
        goPrev,
    } = useCdrRecords(companyId, filters)
    const { metrics, loading: metricsLoading } = useCdrMetrics(companyId, filters)

    const selectedExtension =
        extensions.find((e) => e.alias === extensionAlias) ?? null

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
                title="CDR"
                description="Histórico de chamadas (Call Detail Records)"
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
                    <CdrMetricsCards metrics={metrics} loading={metricsLoading} />

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                        <Combobox<Extension>
                            items={extensions}
                            value={selectedExtension}
                            itemToStringLabel={(e) => `${e.alias} - ${e.name}`}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onValueChange={(e) => setExtensionAlias(e?.alias ?? "")}
                        >
                            <ComboboxInput
                                placeholder="Filtrar por ramal..."
                                className="w-full"
                            />
                            <ComboboxContent>
                                <ComboboxEmpty>Nenhum ramal</ComboboxEmpty>
                                <ComboboxList>
                                    {(e: Extension) => (
                                        <ComboboxItem key={e.id} value={e}>
                                            {e.alias} - {e.name}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                        <Input
                            placeholder="Número de origem..."
                            value={src}
                            onChange={(e) => setSrc(e.target.value)}
                            className="w-full"
                        />
                        <Input
                            placeholder="Número de destino..."
                            value={dst}
                            onChange={(e) => setDst(e.target.value)}
                            className="w-full"
                        />
                        <Select
                            items={DIRECTION_OPTIONS}
                            value={direction}
                            onValueChange={(v) => setDirection(v ?? "all")}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DIRECTION_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            items={STATUS_OPTIONS}
                            value={callStatus}
                            onValueChange={(v) => setCallStatus(v ?? "all")}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <Combobox<Queue>
                            items={queues}
                            value={queues.find((q) => q.id === queueId) ?? null}
                            itemToStringLabel={(q) => `${q.name} (${q.number})`}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onValueChange={(q) => setQueueId(q?.id ?? "all")}
                        >
                            <ComboboxInput
                                placeholder="Filtrar por fila..."
                                className="w-full"
                            />
                            <ComboboxContent>
                                <ComboboxEmpty>Nenhuma fila</ComboboxEmpty>
                                <ComboboxList>
                                    {(q: Queue) => (
                                        <ComboboxItem key={q.id} value={q}>
                                            {q.name} ({q.number})
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
                                        className="w-full justify-start font-normal"
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

                    <CdrTable
                        records={records}
                        trunks={trunks}
                        loading={loading}
                        companyId={companyId}
                    />

                    <DataPagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        onPageChange={(newPage) =>
                            newPage > page ? goNext() : goPrev()
                        }
                    />
                </>
            )}
        </div>
    )
}

export const Route = createFileRoute("/dashboard/cdr")({
    component: CdrPage,
})
