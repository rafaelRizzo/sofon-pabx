import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { WebphoneCallHistory } from "@/components/Webphone/webphone-call-history"
import { WebphoneCallPanel } from "@/components/Webphone/webphone-call-panel"
import { WebphoneStatusBadge } from "@/components/Webphone/webphone-status-badge"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useWebphone } from "@/hooks/use-webphone"
import { useAgentStatus } from "@/hooks/use-agent-status"

// Self-service do agente: atender/discar (mesmo UserAgent do widget flutuante, via
// WebphoneProvider) + pausar/retomar em todas as filas de uma vez (PUT
// /callcenter/agent-status/me, ver backend/src/modules/callcenter/agent-status).
function AgentPanelPage() {
    const { user } = useAuth()
    const {
        registrationStatus,
        unavailable,
        unavailableReason,
        callState,
        remoteIdentity,
        micError,
        muted,
        held,
        transferring,
        callStartedAt,
        audioElRef,
        call,
        answer,
        reject,
        hangup,
        toggleMute,
        toggleHold,
        transfer,
        sendDtmf,
        retryMic,
    } = useWebphone()
    const { status, loading: statusLoading, pause, resume } = useAgentStatus()
    const [reasonId, setReasonId] = useState("")

    // Sem isso, um motivo selecionado que some da lista (catálogo mudou, ou refetch trouxe uma
    // lista vazia) deixa o Select "orfão": o Base UI Select.Value não acha o item pra exibir o
    // label e cai pra mostrar o próprio id cru no trigger.
    useEffect(() => {
        if (reasonId && !status?.availableReasons.some((r) => r.id === reasonId))
            setReasonId("")
    }, [reasonId, status?.availableReasons])

    if (!user?.extensionId) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title="Atendimento" description="Painel do agente" />
                <p className="text-sm text-muted-foreground">
                    Seu usuário não tem ramal vinculado - peça a um
                    administrador pra vincular um ramal em Usuários.
                </p>
            </div>
        )
    }

    const paused = status?.paused ?? false

    const handleTogglePause = async () => {
        if (paused) {
            await resume()
            return
        }
        if (!reasonId) return
        const ok = await pause(reasonId)
        if (ok) setReasonId("")
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Atendimento"
                description="Softphone, pausa e filas do seu ramal"
            />
            <audio ref={audioElRef} autoPlay />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Softphone
                            <WebphoneStatusBadge status={registrationStatus} />
                        </CardTitle>
                        {unavailable && (
                            <CardDescription>
                                {unavailableReason ?? "Softphone indisponível"}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        {micError && (
                            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5">
                                <p className="text-xs text-destructive">{micError}</p>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={retryMic}
                                >
                                    Tentar novamente
                                </Button>
                            </div>
                        )}

                        <WebphoneCallPanel
                            registered={registrationStatus === "registered"}
                            callState={callState}
                            remoteIdentity={remoteIdentity}
                            muted={muted}
                            held={held}
                            transferring={transferring}
                            callStartedAt={callStartedAt}
                            call={call}
                            answer={answer}
                            reject={reject}
                            hangup={hangup}
                            toggleMute={toggleMute}
                            toggleHold={toggleHold}
                            transfer={transfer}
                            sendDtmf={sendDtmf}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Status
                            <Badge
                                className={cn(
                                    "border-transparent",
                                    paused
                                        ? "bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300"
                                        : "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300"
                                )}
                            >
                                {paused ? "Pausado" : "Disponível"}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            Aplica em todas as filas que você participa
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!paused && (
                            <Select
                                value={reasonId}
                                onValueChange={(v) => setReasonId(v ?? "")}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Motivo da pausa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(status?.availableReasons ?? []).map(
                                        (r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.label}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        <Button
                            variant={paused ? "default" : "outline"}
                            disabled={
                                statusLoading || (!paused && !reasonId)
                            }
                            onClick={handleTogglePause}
                        >
                            {paused ? "Retomar atendimento" : "Pausar"}
                        </Button>
                        {paused && status?.pauseReason && (
                            <p className="text-xs text-muted-foreground">
                                Motivo: {status.pauseReason}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filas</CardTitle>
                    <CardDescription>
                        Suas filas e o estado individual de cada uma
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {status?.queues.length ? (
                        <div className="flex flex-col gap-2">
                            {status.queues.map((q) => (
                                <div
                                    key={q.queueId}
                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                >
                                    <span>
                                        {q.queueName}{" "}
                                        <span className="text-muted-foreground">
                                            #{q.queueNumber}
                                        </span>
                                    </span>
                                    <Badge variant={q.paused ? "outline" : "default"}>
                                        {q.paused
                                            ? q.pauseReason
                                                ? `Pausado - ${q.pauseReason}`
                                                : "Pausado"
                                            : "Ativo"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Você não é membro de nenhuma fila
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Últimas chamadas</CardTitle>
                    <CardDescription>
                        Suas últimas 100 chamadas (diretas e de fila atendidas)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WebphoneCallHistory />
                </CardContent>
            </Card>
        </div>
    )
}

export const Route = createFileRoute("/dashboard/atendimento")({
    component: AgentPanelPage,
})
