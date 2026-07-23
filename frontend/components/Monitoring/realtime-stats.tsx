"use client"

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { RealtimeExtension, RealtimeQueue } from "@/hooks/use-realtime"

type Props = {
    extensions: RealtimeExtension[]
    queues: RealtimeQueue[]
    loading: boolean
}

function StatTile({
    label,
    value,
    loading,
}: {
    label: string
    value: number
    loading: boolean
}) {
    return (
        <Card size="sm">
            <CardContent className="flex flex-col gap-1">
                <CardDescription>{label}</CardDescription>
                {loading ? (
                    <Skeleton className="h-8 w-12" />
                ) : (
                    <CardTitle className="text-3xl font-semibold">
                        {value}
                    </CardTitle>
                )}
            </CardContent>
        </Card>
    )
}

// Derivado só do que já está na tela (extensions/queues do polling de 1s) — sem request adicional.
// "Em andamento" conta só callState "in_call" (atendida/bridged) — NÃO inclui "ringing": no
// Asterisk o caller continua em queue.waiting até atender ou desligar, então enquanto toca no
// ramal ele já está em "espera" (ver Filas). Contar ringing aqui também somaria a mesma chamada
// duas vezes (1 tocando apareceria como 1 em andamento + 1 em espera ao mesmo tempo).
export function RealtimeStats({ extensions, queues, loading }: Props) {
    const idleCount = extensions.filter((e) => e.callState === "idle").length
    const inCallCount = extensions.filter(
        (e) => e.callState === "in_call"
    ).length
    const waitingCount = queues.reduce((sum, q) => sum + q.waiting.length, 0)

    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
                label="Ramais livres"
                value={idleCount}
                loading={loading}
            />
            <StatTile
                label="Chamadas em andamento"
                value={inCallCount}
                loading={loading}
            />
            <StatTile
                label="Chamadas em espera"
                value={waitingCount}
                loading={loading}
            />
        </div>
    )
}
