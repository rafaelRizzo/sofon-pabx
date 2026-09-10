"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, DownloadIcon, StarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { DataPagination } from "@/components/data-pagination"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    downloadCallRatingRecording,
    downloadCallRatingsExport,
    useCallRatings,
} from "@/hooks/use-call-ratings"
import { useExtensions, type Extension } from "@/hooks/use-extensions"
import { apiError } from "@/lib/api"
import { type CallRatingsPanelProps } from "@/components/Callcenter/types"

// "YYYY-MM-DD" -> Date local (evita o shift de fuso de "new Date(string)", que interpreta como UTC)
function parseDateOnly(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
}

const ORDER_OPTIONS = [
    { value: "desc", label: "Mais recentes" },
    { value: "asc", label: "Mais antigas" },
] as const

function StarRating({ score }: { score: number }) {
    return (
        <div className="flex items-center gap-0.5" aria-label={`${score}/5`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <StarIcon
                    key={i}
                    className={cn(
                        "size-3.5",
                        i <= score
                            ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                            : "fill-current text-zinc-300 dark:text-zinc-600"
                    )}
                />
            ))}
        </div>
    )
}

const SCORE_OPTIONS = [
    { value: "all", label: "Todas as notas" },
    { value: "5", label: "5 estrelas" },
    { value: "4", label: "4 estrelas" },
    { value: "3", label: "3 estrelas" },
    { value: "2", label: "2 estrelas" },
    { value: "1", label: "1 estrela" },
] as const

export function CallRatingsPanel({ companyId }: CallRatingsPanelProps) {
    const { extensions } = useExtensions(companyId)
    const [extensionId, setExtensionId] = useState<string>("")
    const [number, setNumber] = useState("")
    const [score, setScore] = useState<string>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [order, setOrder] = useState<"asc" | "desc">("desc")
    const [exporting, setExporting] = useState(false)

    const filters = {
        extensionId: extensionId || undefined,
        number: number || undefined,
        score: score !== "all" ? Number(score) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        order,
    }

    const { ratings, total, loading, page, totalPages, goToPage } =
        useCallRatings(companyId, filters, 20)

    const selectedExtension =
        extensions.find((e) => e.id === extensionId) ?? null
    const extensionLabel = (id: string) => {
        const ext = extensions.find((e) => e.id === id)
        return ext ? `${ext.alias} - ${ext.name}` : id
    }

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

    const handleExport = async () => {
        setExporting(true)
        const id = toast.loading("Gerando export...")
        try {
            await downloadCallRatingsExport(companyId, filters)
            toast.success("Export gerado", { id })
        } catch (err) {
            toast.error(apiError(err, "Erro ao exportar notas"), { id })
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    Notas de 1 a 5 dadas pelo cliente na pesquisa de
                    satisfação pós-atendimento
                    {total > 0 && ` (${total} registro(s))`}.
                </p>
                <Button variant="outline" onClick={handleExport} disabled={exporting}>
                    <DownloadIcon />
                    Exportar
                </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
                <Combobox<Extension>
                    items={extensions}
                    value={selectedExtension}
                    itemToStringLabel={(e) => `${e.alias} - ${e.name}`}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(e) => setExtensionId(e?.id ?? "")}
                >
                    <ComboboxInput
                        placeholder="Filtrar por ramal..."
                        className="w-56"
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
                    placeholder="Número do cliente..."
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-40"
                />
                <Popover>
                    <PopoverTrigger
                        render={
                            <Button
                                variant="outline"
                                className="w-48 justify-start font-normal"
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
                <Select
                    items={SCORE_OPTIONS}
                    value={score}
                    onValueChange={(v) => setScore(v ?? "all")}
                >
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Todas as notas" />
                    </SelectTrigger>
                    <SelectContent>
                        {SCORE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    items={ORDER_OPTIONS}
                    value={order}
                    onValueChange={(v) => setOrder(v as "asc" | "desc")}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ORDER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ramal</TableHead>
                            <TableHead>Número</TableHead>
                            <TableHead>Atendimento</TableHead>
                            <TableHead>Serviço contratado</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-center">
                                Ações
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 6 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : ratings.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Nenhuma nota registrada
                                </TableCell>
                            </TableRow>
                        ) : (
                            ratings.map((rating) => (
                                <TableRow key={rating.id}>
                                    <TableCell className="font-medium">
                                        {extensionLabel(rating.extensionId)}
                                    </TableCell>
                                    <TableCell>{rating.number}</TableCell>
                                    <TableCell>
                                        {rating.scoreAtendimento != null ? (
                                            <StarRating score={rating.scoreAtendimento} />
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {rating.scoreServico != null ? (
                                            <StarRating score={rating.scoreServico} />
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(
                                            rating.createdAt
                                        ).toLocaleString("pt-BR")}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {rating.hasRecording ? (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() =>
                                                    downloadCallRatingRecording(
                                                        rating.id,
                                                        companyId
                                                    )
                                                }
                                            >
                                                <DownloadIcon />
                                                <span className="sr-only">
                                                    Baixar gravação
                                                </span>
                                            </Button>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={goToPage}
            />
        </div>
    )
}
