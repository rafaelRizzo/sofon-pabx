"use client"

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
} from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardOverview } from "@/hooks/use-dashboard"

// Janelas de tempo aninhadas (ontem ⊂ hoje ⊂ mês ⊂ ano), não categorias soltas - por isso a
// escala sequencial (--chart-1..4, mesmo hue, luminância crescente), não uma paleta categórica
type BarSpec = {
    key: keyof Pick<
        DashboardOverview,
        "callsYesterday" | "callsToday" | "callsThisMonth" | "callsThisYear"
    >
    label: string
    color: string
}

const BARS: BarSpec[] = [
    { key: "callsYesterday", label: "Ontem", color: "var(--chart-1)" },
    { key: "callsToday", label: "Hoje", color: "var(--chart-2)" },
    { key: "callsThisMonth", label: "Mês", color: "var(--chart-3)" },
    { key: "callsThisYear", label: "Ano", color: "var(--chart-4)" },
]

type TooltipPayload = { payload: { label: string; value: number } }

function ChartTooltip({
    active,
    payload,
}: {
    active?: boolean
    payload?: TooltipPayload[]
}) {
    if (!active || !payload?.length) return null
    const point = payload[0]!.payload
    return (
        <div className="rounded-md border border-input bg-popover px-2.5 py-1.5 text-xs shadow-sm">
            <p className="font-medium text-popover-foreground">{point.label}</p>
            <p className="font-mono tabular-nums text-muted-foreground">
                {point.value} chamada{point.value === 1 ? "" : "s"}
            </p>
        </div>
    )
}

type Props = {
    overview: DashboardOverview | null
    loading: boolean
}

export function DashboardCallsComparisonChart({ overview, loading }: Props) {
    const data = BARS.map((bar) => ({
        label: bar.label,
        value: overview?.[bar.key] ?? 0,
        color: bar.color,
    }))

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Comparativo de chamadas</CardTitle>
                <CardDescription>Ontem, hoje, mês e ano</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center">
                {loading ? (
                    <Skeleton className="h-56 w-full" />
                ) : (
                    <ResponsiveContainer width="100%" height={224}>
                        <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                            />
                            <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
                                {data.map((entry) => (
                                    <Cell key={entry.label} fill={entry.color} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    className="fill-foreground text-xs font-medium"
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
