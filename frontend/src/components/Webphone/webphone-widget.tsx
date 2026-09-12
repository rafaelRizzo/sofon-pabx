"use client"

import { useLocation } from "@tanstack/react-router"

import { WebphoneCallPanel } from "@/components/Webphone/webphone-call-panel"
import { WebphoneStatusBadge } from "@/components/Webphone/webphone-status-badge"
import { useWebphone } from "@/hooks/use-webphone"

// Widget flutuante montado uma vez no layout do dashboard (ver routes/dashboard.tsx) - só
// renderiza se o usuário logado tiver um ramal vinculado (User.extensionId) e o softphone
// não estiver "unavailable" (ramal sem WebRTC habilitado, ou sem config de WS no backend).
// Escondido no Painel do Agente (/dashboard/atendimento) - lá os mesmos controles já aparecem
// na própria página, o widget flutuante em cima seria só duplicata.
export function WebphoneWidget() {
    const { pathname } = useLocation()
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

    if (!enabled || pathname.startsWith("/dashboard/atendimento")) return null

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
                <WebphoneStatusBadge registered={registered} />
            </div>

            {micError && (
                <p className="mt-2 text-xs text-destructive">{micError}</p>
            )}

            <div className="mt-2">
                <WebphoneCallPanel
                    registered={registered}
                    callState={callState}
                    remoteIdentity={remoteIdentity}
                    muted={muted}
                    call={call}
                    answer={answer}
                    reject={reject}
                    hangup={hangup}
                    toggleMute={toggleMute}
                />
            </div>
        </div>
    )
}
