"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    Inviter,
    Registerer,
    RegistererState,
    Session,
    SessionState,
    UserAgent,
    Web,
    type Invitation,
} from "sip.js"

import { api, apiError } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

export type CallState = "idle" | "calling" | "ringing" | "in-call"

// navegadores só liberam getUserMedia em contexto seguro (https ou localhost) — sem domínio/TLS
// ainda (ver install-asterisk.sh), o áudio real só funciona acessando o painel via localhost/VPN
const MIC_BLOCKED_MESSAGE =
    "Não foi possível acessar o microfone. Navegadores bloqueiam isso fora de HTTPS/localhost."

function asWebSdh(session: Session | null): Web.SessionDescriptionHandler | null {
    const sdh = session?.sessionDescriptionHandler
    return sdh instanceof Web.SessionDescriptionHandler ? sdh : null
}

export function useWebphone() {
    const { user } = useAuth()
    const enabled = !!user?.extensionId

    const [registered, setRegistered] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
    const [callState, setCallState] = useState<CallState>("idle")
    const [remoteIdentity, setRemoteIdentity] = useState<string | null>(null)
    const [micError, setMicError] = useState<string | null>(null)
    const [muted, setMuted] = useState(false)

    const userAgentRef = useRef<UserAgent | null>(null)
    const registererRef = useRef<Registerer | null>(null)
    const sessionRef = useRef<Session | null>(null)
    const audioElRef = useRef<HTMLAudioElement | null>(null)

    const resetCall = useCallback(() => {
        sessionRef.current = null
        setCallState("idle")
        setRemoteIdentity(null)
        setMuted(false)
        if (audioElRef.current) audioElRef.current.srcObject = null
    }, [])

    const bindSession = useCallback(
        (session: Session, direction: "incoming" | "outgoing") => {
            sessionRef.current = session
            setRemoteIdentity(
                session.remoteIdentity.displayName || session.remoteIdentity.uri.user || null
            )
            setCallState(direction === "incoming" ? "ringing" : "calling")

            session.stateChange.addListener((state: SessionState) => {
                if (session !== sessionRef.current) return
                if (state === SessionState.Established) {
                    setCallState("in-call")
                    const sdh = asWebSdh(session)
                    if (sdh && audioElRef.current) {
                        audioElRef.current.srcObject = sdh.remoteMediaStream
                        audioElRef.current.play().catch(() => {})
                    }
                } else if (state === SessionState.Terminated) {
                    resetCall()
                }
            })
        },
        [resetCall]
    )

    useEffect(() => {
        if (!enabled) return
        let disposed = false

        const fail = (reason: string) => {
            if (disposed) return
            setUnavailable(true)
            setUnavailableReason(reason)
        }

        const setup = async () => {
            let config: { wsScheme: "ws" | "wss"; wsHost: string | null; wsPort: number; wsPath: string }
            let creds: { username: string; password: string; displayName: string }

            try {
                const [sipConfigRes, credsRes] = await Promise.all([
                    api.get("/system/sip-config"),
                    api.get("/extensions/me/webrtc"),
                ])
                if (disposed) return
                config = sipConfigRes.data.webrtc
                creds = credsRes.data.webrtc
            } catch (err) {
                fail(apiError(err, "Não foi possível carregar as credenciais do ramal"))
                return
            }

            if (!config.wsHost) {
                fail("Servidor WebSocket não configurado no backend (PUBLIC_ADDRESS/WS_PORT no .env)")
                return
            }

            const uri = UserAgent.makeURI(`sip:${creds.username}@${config.wsHost}`)
            if (!uri) {
                fail("URI SIP inválida gerada a partir das credenciais do ramal")
                return
            }

            const server = `${config.wsScheme}://${config.wsHost}:${config.wsPort}${config.wsPath}`
            const userAgent = new UserAgent({
                uri,
                displayName: creds.displayName,
                authorizationUsername: creds.username,
                authorizationPassword: creds.password,
                transportOptions: { server },
                delegate: {
                    onInvite: (invitation: Invitation) => {
                        bindSession(invitation, "incoming")
                    },
                    onDisconnect: (error) => {
                        // eslint-disable-next-line no-console
                        console.error("[webphone] transporte WS caiu", error)
                    },
                },
            })
            userAgentRef.current = userAgent

            try {
                await userAgent.start()
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[webphone] falha ao abrir o WebSocket", server, err)
                fail(`Não foi possível abrir o WebSocket (${server}) — veja o console pro erro completo`)
                return
            }
            if (disposed) return

            try {
                const registerer = new Registerer(userAgent)
                registererRef.current = registerer
                registerer.stateChange.addListener((state) => {
                    setRegistered(state === RegistererState.Registered)
                })
                await registerer.register({
                    requestDelegate: {
                        onReject: (response) => {
                            // eslint-disable-next-line no-console
                            console.error(
                                "[webphone] REGISTER rejeitado",
                                response.message.statusCode,
                                response.message.reasonPhrase
                            )
                            fail(
                                `REGISTER rejeitado pelo Asterisk: ${response.message.statusCode} ${response.message.reasonPhrase}`
                            )
                        },
                    },
                })
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[webphone] falha ao registrar", err)
                fail("Falha ao enviar REGISTER — veja o console pro erro completo")
            }
        }

        setup()

        return () => {
            disposed = true
            registererRef.current?.unregister().catch(() => {})
            userAgentRef.current?.stop().catch(() => {})
            userAgentRef.current = null
            registererRef.current = null
        }
    }, [enabled, bindSession])

    const ensureMic = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach((t) => t.stop())
            setMicError(null)
            return true
        } catch {
            setMicError(MIC_BLOCKED_MESSAGE)
            return false
        }
    }, [])

    const call = useCallback(
        async (number: string) => {
            const userAgent = userAgentRef.current
            if (!userAgent || !number.trim()) return
            if (!(await ensureMic())) return

            const target = UserAgent.makeURI(`sip:${number}@${userAgent.configuration.uri.host}`)
            if (!target) return

            const inviter = new Inviter(userAgent, target)
            bindSession(inviter, "outgoing")
            await inviter.invite().catch(() => resetCall())
        },
        [bindSession, ensureMic, resetCall]
    )

    const answer = useCallback(async () => {
        const session = sessionRef.current
        if (!session || session.state !== SessionState.Initial) return
        if (!(await ensureMic())) return
        await (session as Invitation).accept().catch(() => resetCall())
    }, [ensureMic, resetCall])

    const reject = useCallback(async () => {
        const session = sessionRef.current
        if (!session) return
        await (session as Invitation).reject().catch(() => {})
    }, [])

    const hangup = useCallback(async () => {
        const session = sessionRef.current
        if (!session) return
        if (session.state === SessionState.Established) await session.bye().catch(() => {})
        else if (session instanceof Inviter) await session.cancel().catch(() => {})
        else await (session as Invitation).reject().catch(() => {})
    }, [])

    const toggleMute = useCallback(() => {
        const sdh = asWebSdh(sessionRef.current)
        if (!sdh) return
        setMuted((prev) => {
            sdh.enableSenderTracks(prev)
            return !prev
        })
    }, [])

    return {
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
    }
}
