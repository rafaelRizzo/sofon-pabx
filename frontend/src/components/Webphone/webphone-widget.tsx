"use client"

import { useState } from "react"
import {
    MicIcon,
    MicOffIcon,
    PhoneIcon,
    PhoneOffIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useWebphone } from "@/hooks/use-webphone"

// Widget flutuante montado uma vez no layout do dashboard (ver routes/dashboard.tsx) - só
// renderiza se o usuário logado tiver um ramal vinculado (User.extensionId) e o softphone
// não estiver "unavailable" (ramal sem WebRTC habilitado, ou sem config de WS no backend)
export function WebphoneWidget() {
    const {
        enabled,
        registered,
        unavailable,
        unavailableReason,
        callState,
        remoteIdentity,
        micError,
        muted,
        audioElRef,
        call,
        answer,
        reject,
        hangup,
        toggleMute,
    } = useWebphone()
    const [number, setNumber] = useState("")

    if (!enabled) return null

    // não escondemos totalmente quando indisponível - sem isso, "não aconteceu nada" é a única
    // pista que o usuário vinculado a um ramal tem pra saber que o softphone não conectou
    if (unavailable) {
        return (
            <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-card p-3 text-xs text-muted-foreground shadow-lg">
                <p className="font-medium text-foreground">Softphone indisponível</p>
                <p className="mt-1">{unavailableReason ?? "Motivo desconhecido"}</p>
            </div>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-card p-3 shadow-lg">
            <audio ref={audioElRef} autoPlay />
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Softphone</span>
                <span
                    className={cn(
                        "h-2 w-2 rounded-full",
                        registered ? "bg-green-500" : "bg-muted-foreground/40"
                    )}
                    title={registered ? "Registrado" : "Conectando..."}
                />
            </div>

            {micError && (
                <p className="mt-2 text-xs text-destructive">{micError}</p>
            )}

            {callState === "idle" && (
                <div className="mt-2 flex gap-2">
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
            )}

            {callState === "ringing" && (
                <div className="mt-2">
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
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={reject}
                        >
                            Rejeitar
                        </Button>
                    </div>
                </div>
            )}

            {(callState === "calling" || callState === "in-call") && (
                <div className="mt-2">
                    <p className="text-sm">
                        {callState === "calling" ? "Chamando" : "Em chamada"}
                        {remoteIdentity ? ` - ${remoteIdentity}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                        {callState === "in-call" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={toggleMute}
                            >
                                {muted ? <MicOffIcon /> : <MicIcon />}
                                <span className="sr-only">Mudo</span>
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={hangup}
                        >
                            <PhoneOffIcon />
                            Desligar
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
