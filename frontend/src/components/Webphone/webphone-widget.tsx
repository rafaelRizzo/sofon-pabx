"use client"

import { useEffect, useState } from "react"
import { useLocation } from "@tanstack/react-router"
import { PhoneIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WebphoneCallPanel } from "@/components/Webphone/webphone-call-panel"
import { WebphoneStatusBadge } from "@/components/Webphone/webphone-status-badge"
import { useWebphone, type WebphoneRegistrationStatus } from "@/hooks/use-webphone"

const DOT_CLASS: Record<WebphoneRegistrationStatus, string> = {
    registered: "bg-emerald-500",
    connecting: "bg-muted-foreground",
    error: "bg-red-500",
}

// Bolha flutuante do estado fechado - só ícone + pontinho de status, pra não competir
// com o resto da tela quando o agente não está discando/atendendo nada.
function WebphoneBubble({
    status,
    onClick,
}: {
    status: WebphoneRegistrationStatus
    onClick: () => void
}) {
    return (
        <Button
            size="icon"
            onClick={onClick}
            className="fixed bottom-4 right-4 z-50 size-12 rounded-full shadow-lg"
        >
            <PhoneIcon className="size-5" />
            <span
                className={cn(
                    "absolute right-0.5 top-0.5 size-2.5 rounded-full ring-2 ring-background",
                    DOT_CLASS[status]
                )}
            />
            <span className="sr-only">Abrir softphone</span>
        </Button>
    )
}

// Widget flutuante montado uma vez no layout do dashboard (ver routes/dashboard.tsx) - só
// renderiza se o usuário logado tiver um ramal vinculado (User.extensionId) e o softphone
// não estiver "unavailable" (ramal sem WebRTC habilitado, ou sem config de WS no backend).
// Escondido no Painel do Agente (/dashboard/atendimento) - lá os mesmos controles já aparecem
// na própria página, o widget flutuante em cima seria só duplicata.
export function WebphoneWidget() {
    const { pathname } = useLocation()
    const {
        enabled,
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
        attendedState,
        attendedRemoteIdentity,
        audioElRef,
        call,
        answer,
        reject,
        hangup,
        toggleMute,
        toggleHold,
        transfer,
        startAttendedTransfer,
        completeAttendedTransfer,
        cancelAttendedTransfer,
        sendDtmf,
        retryMic,
    } = useWebphone()
    const [open, setOpen] = useState(false)

    // chamada tocando/em andamento sempre força o painel aberto - não dá pra perder uma
    // chamada entrante só porque o widget estava recolhido
    const hasActiveCall = callState !== "idle"
    useEffect(() => {
        if (hasActiveCall) setOpen(true)
    }, [hasActiveCall])

    if (!enabled || pathname.startsWith("/dashboard/atendimento")) return null

    if (!open) {
        return <WebphoneBubble status={registrationStatus} onClick={() => setOpen(true)} />
    }

    // não escondemos totalmente quando indisponível - sem isso, "não aconteceu nada" é a única
    // pista que o usuário vinculado a um ramal tem pra saber que o softphone não conectou
    if (unavailable) {
        return (
            <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card p-3 text-xs text-muted-foreground shadow-lg">
                <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Softphone indisponível</p>
                    <div className="flex items-center gap-1">
                        <WebphoneStatusBadge status={registrationStatus} />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            onClick={() => setOpen(false)}
                        >
                            <XIcon className="size-3.5" />
                            <span className="sr-only">Fechar</span>
                        </Button>
                    </div>
                </div>
                <p className="mt-1">{unavailableReason ?? "Motivo desconhecido"}</p>
            </div>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card p-4 shadow-lg">
            <audio ref={audioElRef} autoPlay />
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Softphone</span>
                <div className="flex items-center gap-1">
                    <WebphoneStatusBadge status={registrationStatus} />
                    {!hasActiveCall && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            onClick={() => setOpen(false)}
                        >
                            <XIcon className="size-3.5" />
                            <span className="sr-only">Fechar</span>
                        </Button>
                    )}
                </div>
            </div>

            {micError && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1.5">
                    <p className="text-xs text-destructive">{micError}</p>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={retryMic}>
                        Tentar novamente
                    </Button>
                </div>
            )}

            <div className="mt-3">
                <WebphoneCallPanel
                    registered={registrationStatus === "registered"}
                    callState={callState}
                    remoteIdentity={remoteIdentity}
                    muted={muted}
                    held={held}
                    transferring={transferring}
                    callStartedAt={callStartedAt}
                    attendedState={attendedState}
                    attendedRemoteIdentity={attendedRemoteIdentity}
                    call={call}
                    answer={answer}
                    reject={reject}
                    hangup={hangup}
                    toggleMute={toggleMute}
                    toggleHold={toggleHold}
                    transfer={transfer}
                    startAttendedTransfer={startAttendedTransfer}
                    completeAttendedTransfer={completeAttendedTransfer}
                    cancelAttendedTransfer={cancelAttendedTransfer}
                    sendDtmf={sendDtmf}
                />
            </div>
        </div>
    )
}
