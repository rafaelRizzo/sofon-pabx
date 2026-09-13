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
    Volume1Icon,
    Volume2Icon,
    XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
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
    ringtoneVolume: number
    setRingtoneVolume: (next: number) => void
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

function CallAvatar({ name, className }: { name: string | null; className?: string }) {
    const initials = getInitials(name)
    return (
        <div
            className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-sm font-medium text-primary",
                className
            )}
        >
            {initials ?? <PhoneIcon className="size-4" />}
        </div>
    )
}

// Ponto verde pulsante sobre o avatar - a mesma linguagem visual de "chamada ao vivo" de um
// app de telefonia nativo, só aparece com áudio realmente fluindo (em chamada e sem hold).
function LiveDot() {
    return (
        <span className="absolute -right-0.5 -top-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/75" />
            <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        </span>
    )
}

type ControlButtonProps = {
    icon: React.ComponentType<{ className?: string }>
    label: string
    active?: boolean
    onClick: () => void
}

// Botão circular do "controle de chamada" (mudo/espera/transferir/teclado) - mesmo componente
// pros dois estados visuais (ativo = preenchido) pra não repetir a variante 4x.
function ControlButton({ icon: Icon, label, active, onClick }: ControlButtonProps) {
    return (
        <Button
            size="icon"
            variant={active ? "default" : "outline"}
            className="size-11 rounded-full"
            onClick={onClick}
        >
            <Icon className="size-4" />
            <span className="sr-only">{label}</span>
        </Button>
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
    ringtoneVolume,
    setRingtoneVolume,
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
            <div className="flex flex-col items-center gap-4 py-1 text-center">
                <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping" />
                    <CallAvatar name={remoteIdentity} className="relative size-16 text-lg" />
                </div>
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Chamada recebida
                    </p>
                    <p className="text-base font-semibold">{remoteIdentity ?? "Desconhecido"}</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1.5">
                        <Button
                            size="icon"
                            variant="destructive"
                            className="size-12 rounded-full"
                            onClick={reject}
                        >
                            <PhoneOffIcon className="size-5" />
                            <span className="sr-only">Rejeitar</span>
                        </Button>
                        <span className="text-[11px] text-muted-foreground">Rejeitar</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <Button
                            size="icon"
                            className="size-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                            onClick={answer}
                        >
                            <PhoneIcon className="size-5" />
                            <span className="sr-only">Atender</span>
                        </Button>
                        <span className="text-[11px] text-muted-foreground">Atender</span>
                    </div>
                </div>
                <div className="flex w-full items-center gap-2 text-muted-foreground">
                    {ringtoneVolume <= 0.4 ? (
                        <Volume1Icon className="size-3.5 shrink-0" />
                    ) : (
                        <Volume2Icon className="size-3.5 shrink-0" />
                    )}
                    <Slider
                        min={15}
                        max={100}
                        step={5}
                        value={[Math.round(ringtoneVolume * 100)]}
                        onValueChange={(v) =>
                            setRingtoneVolume((Array.isArray(v) ? v[0] : v) / 100)
                        }
                        aria-label="Volume do toque"
                    />
                </div>
            </div>
        )
    }

    const inCall = callState === "in-call"
    const live = inCall && !held
    const inAttendedTransfer = attendedState !== "idle"

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-1 text-center">
                <div className="relative">
                    {live && <LiveDot />}
                    <CallAvatar name={remoteIdentity} className="size-16 text-lg" />
                </div>
                <div>
                    <p className="text-base font-semibold">
                        {remoteIdentity ?? "Chamando..."}
                    </p>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5">
                        {!inCall && (
                            <span className="text-xs text-muted-foreground">Chamando...</span>
                        )}
                        {inCall && held && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                Em espera
                            </span>
                        )}
                        {inCall && !held && callStartedAt && (
                            <WebphoneCallTimer
                                startedAt={callStartedAt}
                                className="text-sm font-medium text-foreground"
                            />
                        )}
                    </div>
                </div>
            </div>

            {inCall && inAttendedTransfer && (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
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
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
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

            <div className="flex flex-col items-center gap-3">
                {inCall && (
                    <div className="flex items-center justify-center gap-2">
                        <ControlButton
                            icon={muted ? MicOffIcon : MicIcon}
                            label="Mudo"
                            active={muted}
                            onClick={toggleMute}
                        />
                        {!inAttendedTransfer && (
                            <ControlButton
                                icon={held ? PlayIcon : PauseIcon}
                                label={held ? "Retomar" : "Espera"}
                                active={held}
                                onClick={toggleHold}
                            />
                        )}
                        {!inAttendedTransfer && (
                            <ControlButton
                                icon={PhoneForwardedIcon}
                                label="Transferir"
                                active={showTransfer}
                                onClick={() => setShowTransfer((v) => !v)}
                            />
                        )}
                        <ControlButton
                            icon={Grid3x3Icon}
                            label="Teclado"
                            active={showDtmf}
                            onClick={() => setShowDtmf((v) => !v)}
                        />
                    </div>
                )}
                <Button
                    size="icon"
                    variant="destructive"
                    className="size-12 rounded-full shadow-sm"
                    onClick={hangup}
                >
                    <PhoneOffIcon className="size-5" />
                    <span className="sr-only">Desligar</span>
                </Button>
            </div>
        </div>
    )
}
