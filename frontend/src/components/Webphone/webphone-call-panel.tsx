"use client"

import { useEffect, useState } from "react"
import {
    Grid3x3Icon,
    MicIcon,
    MicOffIcon,
    PauseIcon,
    PhoneForwardedIcon,
    PhoneIcon,
    PhoneOffIcon,
    PlayIcon,
    XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AttendedTransferState, SoftphoneCallState } from "@/hooks/use-webphone"
import { WebphoneCallTimer } from "@/components/Webphone/webphone-call-timer"
import { WebphoneDialpad } from "@/components/Webphone/webphone-dialpad"

type WebphoneCallPanelProps = {
    registered: boolean
    callState: SoftphoneCallState
    remoteIdentity: string | null
    muted: boolean
    held: boolean
    transferring: boolean
    callStartedAt: number | null
    attendedState: AttendedTransferState
    attendedRemoteIdentity: string | null
    call: (number: string) => void | Promise<void>
    answer: () => void | Promise<void>
    reject: () => void | Promise<void>
    hangup: () => void | Promise<void>
    toggleMute: () => void
    toggleHold: () => void | Promise<void>
    transfer: (target: string) => void | Promise<void>
    startAttendedTransfer: (target: string) => void | Promise<void>
    completeAttendedTransfer: () => void | Promise<void>
    cancelAttendedTransfer: () => void | Promise<void>
    sendDtmf: (tone: string) => void
}

function getInitials(name: string | null) {
    if (!name) return null
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return null
    const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]
    return initials.toUpperCase()
}

function CallAvatar({ name }: { name: string | null }) {
    const initials = getInitials(name)
    return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {initials ?? <PhoneIcon className="size-4" />}
        </div>
    )
}

// Discador + telas de chamada (tocando/em chamada) do softphone - compartilhado entre o widget
// flutuante (webphone-widget.tsx) e o Painel do Agente (routes/dashboard/atendimento.tsx), os
// dois só diferem no card/layout ao redor, nunca nesse bloco de estado.
export function WebphoneCallPanel({
    registered,
    callState,
    remoteIdentity,
    muted,
    held,
    transferring,
    callStartedAt,
    attendedState,
    attendedRemoteIdentity,
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
}: WebphoneCallPanelProps) {
    const [number, setNumber] = useState("")
    const [showDtmf, setShowDtmf] = useState(false)
    const [showTransfer, setShowTransfer] = useState(false)
    const [transferTarget, setTransferTarget] = useState("")

    // sem isso, o picker de transferência (ou o teclado DTMF) da chamada anterior ficaria aberto
    // por cima da próxima ligação, já que esse componente nunca desmonta entre chamadas
    useEffect(() => {
        if (callState === "idle") {
            setShowDtmf(false)
            setShowTransfer(false)
            setTransferTarget("")
        }
    }, [callState])

    if (callState === "idle") {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    <Input
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Ramal ou número"
                        disabled={!registered}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") call(number)
                        }}
                    />
                    <Button
                        size="icon"
                        disabled={!registered || !number.trim()}
                        onClick={() => call(number)}
                    >
                        <PhoneIcon />
                        <span className="sr-only">Ligar</span>
                    </Button>
                </div>
                <WebphoneDialpad
                    disabled={!registered}
                    onDigit={(digit) => setNumber((prev) => prev + digit)}
                />
            </div>
        )
    }

    if (callState === "ringing") {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <CallAvatar name={remoteIdentity} />
                    <div>
                        <p className="text-xs text-muted-foreground">Chamada de</p>
                        <p className="text-sm font-medium">{remoteIdentity ?? "Desconhecido"}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={answer}>
                        <PhoneIcon />
                        Atender
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={reject}>
                        <PhoneOffIcon />
                        Rejeitar
                    </Button>
                </div>
            </div>
        )
    }

    const inCall = callState === "in-call"
    const inAttendedTransfer = attendedState !== "idle"

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <CallAvatar name={remoteIdentity} />
                <div>
                    <p className="text-sm font-medium">{remoteIdentity ?? "Chamando..."}</p>
                    <p className="text-xs text-muted-foreground">
                        {!inCall && "Chamando"}
                        {inCall && held && "Em espera"}
                        {inCall && !held && callStartedAt && (
                            <WebphoneCallTimer startedAt={callStartedAt} />
                        )}
                    </p>
                </div>
            </div>

            {inCall && inAttendedTransfer && (
                <div className="flex flex-col gap-2 rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">
                        {attendedState === "calling" ? "Consultando" : "Em consulta com"}{" "}
                        <span className="font-medium text-foreground">
                            {attendedRemoteIdentity}
                        </span>
                    </p>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="flex-1"
                            disabled={attendedState !== "in-call"}
                            onClick={completeAttendedTransfer}
                        >
                            Completar
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1"
                            onClick={cancelAttendedTransfer}
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            {inCall && !inAttendedTransfer && showTransfer && (
                <div className="flex flex-col gap-2">
                    <Input
                        autoFocus
                        value={transferTarget}
                        onChange={(e) => setTransferTarget(e.target.value)}
                        placeholder="Ramal destino"
                        disabled={transferring}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setShowTransfer(false)
                        }}
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={transferring || !transferTarget.trim()}
                            onClick={() => transfer(transferTarget)}
                        >
                            {transferring ? "Transferindo..." : "Cega"}
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            disabled={!transferTarget.trim()}
                            onClick={() => startAttendedTransfer(transferTarget)}
                        >
                            Assistida
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setShowTransfer(false)}>
                            <XIcon />
                            <span className="sr-only">Cancelar</span>
                        </Button>
                    </div>
                </div>
            )}

            {inCall && showDtmf && (
                <WebphoneDialpad onDigit={(digit) => sendDtmf(digit)} />
            )}

            <div className="flex flex-wrap gap-2">
                {inCall && (
                    <Button size="sm" variant="outline" onClick={toggleMute}>
                        {muted ? <MicOffIcon /> : <MicIcon />}
                        <span className="sr-only">Mudo</span>
                    </Button>
                )}
                {inCall && !inAttendedTransfer && (
                    <Button
                        size="sm"
                        variant={held ? "default" : "outline"}
                        onClick={toggleHold}
                    >
                        {held ? <PlayIcon /> : <PauseIcon />}
                        <span className="sr-only">{held ? "Retomar" : "Espera"}</span>
                    </Button>
                )}
                {inCall && !inAttendedTransfer && (
                    <Button
                        size="sm"
                        variant={showTransfer ? "default" : "outline"}
                        onClick={() => setShowTransfer((v) => !v)}
                    >
                        <PhoneForwardedIcon />
                        <span className="sr-only">Transferir</span>
                    </Button>
                )}
                {inCall && (
                    <Button
                        size="sm"
                        variant={showDtmf ? "default" : "outline"}
                        onClick={() => setShowDtmf((v) => !v)}
                    >
                        <Grid3x3Icon />
                        <span className="sr-only">Teclado</span>
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="destructive"
                    className={cn(!inCall && "flex-1")}
                    onClick={hangup}
                >
                    <PhoneOffIcon />
                    Desligar
                </Button>
            </div>
        </div>
    )
}
