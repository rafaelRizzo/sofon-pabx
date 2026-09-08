"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { BrazilMap } from "@/components/shadcnmaps/maps/brazil"
import type { RegionOverride } from "@/components/shadcnmaps/types"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
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
    useDashboardCallsByRegion,
    type CallsByRegionDirection,
} from "@/hooks/use-dashboard-calls-by-region"

const UF_NAMES: Record<string, string> = {
    AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
    CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
    MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
    PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
    RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima",
    RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo",
    TO: "Tocantins",
}

const DIRECTION_OPTIONS: { value: CallsByRegionDirection; label: string }[] = [
    { value: "all", label: "Entrada + saída" },
    { value: "inbound", label: "Só entrada" },
    { value: "outbound", label: "Só saída" },
]

// Escala sequencial própria do mapa (--map-bucket-1..5, index.css) - mesmo hue do resto do
// dashboard, mas com curva de luminância própria por tema: no light mode espelha --chart-1..5
// (mais chamadas = mais escuro, funciona bem em fundo claro); no dark mode é invertida (mais
// chamadas = mais claro/vívido), senão os estados com mais chamadas ficariam os menos visíveis
// contra o fundo quase preto do card. Buckets relativos ao pico do período filtrado, não valor
// absoluto fixo. Classes escritas por extenso (não montadas por template string) - o scanner do
// Tailwind lê o texto-fonte literal, uma classe interpolada em runtime (`fill-[${cor}]`) nunca é gerada
// labelClass: no dark mode os buckets 3-5 ficam claros (mais chamadas = mais vívido), texto
// branco fixo ficaria ilegível neles - só 1-2 continuam escuros o bastante pro branco funcionar
const BUCKETS = [
    { min: 0.75, fillClass: "fill-[var(--map-bucket-5)]", labelClass: "fill-white dark:fill-neutral-900" },
    { min: 0.5, fillClass: "fill-[var(--map-bucket-4)]", labelClass: "fill-white dark:fill-neutral-900" },
    { min: 0.25, fillClass: "fill-[var(--map-bucket-3)]", labelClass: "fill-white dark:fill-neutral-900" },
    { min: 0.1, fillClass: "fill-[var(--map-bucket-2)]", labelClass: "fill-white" },
    { min: 0, fillClass: "fill-[var(--map-bucket-1)]", labelClass: "fill-white" },
] as const

// "YYYY-MM-DD" -> Date local (evita o shift de fuso de "new Date(string)", que interpreta como UTC)
function parseDateOnly(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
}

type Props = {
    companyId?: string
}

export function DashboardCallsByRegionMap({ companyId }: Props) {
    const [direction, setDirection] = useState<CallsByRegionDirection>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const { regions, loading } = useDashboardCallsByRegion(companyId, {
        direction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    })

    const dateRange: DateRange | undefined = {
        from: parseDateOnly(startDate),
        to: parseDateOnly(endDate),
    }
    const dateRangeLabel = dateRange.from
        ? dateRange.to
            ? `${format(dateRange.from, "dd/MM/yy")} – ${format(dateRange.to, "dd/MM/yy")}`
            : format(dateRange.from, "dd/MM/yy")
        : "Todo o período"

    function handleDateRangeChange(range: DateRange | undefined) {
        setStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "")
        setEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "")
    }

    const regionById = useMemo(
        () => new Map(regions.map((r) => [r.uf, r])),
        [regions]
    )
    const maxCalls = Math.max(1, ...regions.map((r) => r.calls))

    const mapOverrides: RegionOverride[] = useMemo(
        () =>
            Object.keys(UF_NAMES).map((uf) => {
                const region = regionById.get(uf)
                const calls = region?.calls ?? 0
                const ratio = calls / maxCalls
                const bucket = calls > 0 ? BUCKETS.find((b) => ratio > b.min) : undefined

                return {
                    id: uf,
                    className: bucket
                        ? `${bucket.fillClass} hover:opacity-80`
                        : "fill-muted",
                    // bucket colorido usa o labelClass próprio (contraste varia por tema, ver
                    // BUCKETS); sem chamada usa --map-label (escuro no light, claro no dark)
                    labelClassName: bucket?.labelClass,
                    tooltipContent: (
                        <div className="min-w-32">
                            <p className="font-medium">{UF_NAMES[uf]}</p>
                            <p className="text-muted-foreground">
                                {calls} chamada{calls === 1 ? "" : "s"}
                            </p>
                            {region && region.byDdd.length > 0 && (
                                <ul className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1 text-muted-foreground">
                                    {region.byDdd.map((d) => (
                                        <li key={d.ddd} className="flex justify-between gap-3">
                                            <span>DDD {d.ddd}</span>
                                            <span className="font-mono tabular-nums">{d.calls}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ),
                }
            }),
        [regionById, maxCalls]
    )

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle>Chamadas por região</CardTitle>
                    <CardDescription>Distribuição por UF, com detalhe por DDD</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                        items={DIRECTION_OPTIONS}
                        value={direction}
                        onValueChange={(v) => setDirection(v as CallsByRegionDirection)}
                    >
                        <SelectTrigger className="w-full sm:w-40">
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
                    <Popover>
                        <PopoverTrigger
                            render={
                                <Button
                                    variant="outline"
                                    className="w-full justify-start font-normal sm:w-48"
                                >
                                    <CalendarIcon />
                                    {dateRangeLabel}
                                </Button>
                            }
                        />
                        <PopoverContent className="w-auto p-0" align="end">
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
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center">
                {loading ? (
                    <Skeleton className="h-72 w-full sm:h-80 lg:h-96" />
                ) : (
                    // altura fixa + w-full/h-full no SVG: viewBox quase quadrado deixaria a
                    // altura explodir junto com a largura se h-auto (comportamento padrão).
                    // [&>...] força a div interna do BrazilMap (sem prop de className própria)
                    // a herdar a altura fixa, senão ela fica height:auto e quebra a cadeia de h-full
                    <div className="h-72 w-full sm:h-80 lg:h-96 [&>[data-slot=map-container]]:h-full">
                        <BrazilMap
                            regions={mapOverrides}
                            showTooltips
                            enableZoom
                            aria-label="Chamadas por UF"
                            className="h-full w-full"
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
