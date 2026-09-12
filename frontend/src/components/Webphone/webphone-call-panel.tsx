"use client"

import { useState } from "react"
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SoftphoneCallState } from "@/hooks/use-webphone"

type WebphoneCallPanelProps = {
    registered: boolean
    callState: SoftphoneCallState
    remoteIdentity: string | null
    muted: boolean
    call: (number: string) => void | Promise<void>
    answer: () => void | Promise<void>
    reject: () => void | Promise<void>
    hangup: () => void | Promise<void>
    toggleMute: () => void
}

// Discador + telas de chamada (tocando/em chamada) do softphone - compartilhado entre o widget
// flutuante (webphone-widget.tsx) e o Painel do Agente (routes/dashboard/atendimento.tsx), os
// dois só diferem no card/layout ao redor, nunca nesse bloco de estado.
export function WebphoneCallPanel({
    registered,
    callState,
    remoteIdentity,
    muted,
    call,
    answer,
    reject,
    hangup,
    toggleMute,
}: WebphoneCallPanelProps) {
    const [number, setNumber] = useState("")

    if (callState === "idle") {
        return (
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
        )
    }

    if (callState === "ringing") {
        return (
            <div>
                <p className="text-sm">
                    Chamada de{" "}
                    <span className="font-medium">
                        {remoteIdentity ?? "desconhecido"}
                    </span>
                </p>
                <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={answer}>
                        Atender
                    </Button>
                    <Button size="sm" variant="destructive" onClick={reject}>
                        Rejeitar
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <p className="text-sm">
                {callState === "calling" ? "Chamando" : "Em chamada"}
                {remoteIdentity ? ` - ${remoteIdentity}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
                {callState === "in-call" && (
                    <Button size="sm" variant="outline" onClick={toggleMute}>
                        {muted ? <MicOffIcon /> : <MicIcon />}
                        <span className="sr-only">Mudo</span>
                    </Button>
                )}
                <Button size="sm" variant="destructive" onClick={hangup}>
                    <PhoneOffIcon />
                    Desligar
                </Button>
            </div>
        </div>
    )
}
