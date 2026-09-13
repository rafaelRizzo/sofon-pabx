"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
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

// Estado SIP local do softphone deste browser - não confundir com o CallState de
// use-realtime.ts (estado de chamada do RAMAL inteiro via AMI, valores/semântica diferentes)
export type SoftphoneCallState = "idle" | "calling" | "ringing" | "in-call"

// Estado agregado só pra exibição (badge) - não substitui unavailable/unavailableReason,
// que seguem cobrindo o card de erro grave (motivo detalhado)
export type WebphoneRegistrationStatus = "registered" | "connecting" | "error"

// Perna de consulta da transferência assistida (2ª sessão SIP, paralela à principal) - "ringing"
// não existe aqui porque essa perna é sempre discada por nós (nunca recebida)
export type AttendedTransferState = "idle" | "calling" | "in-call"

// navegadores só liberam getUserMedia em contexto seguro (https ou localhost) - sem domínio/TLS
// ainda (ver install-asterisk.sh), o áudio real só funciona acessando o painel via localhost/VPN
const MIC_INSECURE_CONTEXT_MESSAGE =
    "Softphone requer HTTPS ou localhost - navegadores bloqueiam o microfone fora de um contexto seguro."
const MIC_DENIED_MESSAGE =
    "Permissão de microfone negada. Libere o acesso ao microfone nas configurações do navegador e tente novamente."
const MIC_NOT_FOUND_MESSAGE = "Nenhum microfone encontrado neste dispositivo."
const MIC_GENERIC_MESSAGE = "Não foi possível acessar o microfone."

// piso do volume do toque - nunca deixa o agente zerar e perder uma chamada entrante por engano
const RINGTONE_MIN_VOLUME = 0.15
const RINGTONE_VOLUME_STORAGE_KEY = "webphone:ringtoneVolume"

function loadRingtoneVolume(): number {
    try {
        const raw = window.localStorage.getItem(RINGTONE_VOLUME_STORAGE_KEY)
        const parsed = raw ? Number(raw) : NaN
        if (Number.isFinite(parsed)) return Math.min(1, Math.max(RINGTONE_MIN_VOLUME, parsed))
    } catch {
        // localStorage indisponível (contexto privado etc) - segue no default
    }
    return 0.7
}

function asWebSdh(session: Session | null): Web.SessionDescriptionHandler | null {
    const sdh = session?.sessionDescriptionHandler
    return sdh instanceof Web.SessionDescriptionHandler ? sdh : null
}

// Encerra uma sessão SIP no método certo pro estado em que ela está - estabelecida (BYE),
// discando por nós (CANCEL) ou tocando pra nós (REJECT). Reaproveitado tanto pelo hangup da
// chamada principal quanto pra descartar a perna de consulta de uma transferência assistida.
async function endSession(session: Session | null) {
    if (!session) return
    if (session.state === SessionState.Established) await session.bye().catch(() => {})
    else if (session instanceof Inviter) await session.cancel().catch(() => {})
    else await (session as Invitation).reject().catch(() => {})
}

// Registra UM UserAgent/REGISTER por sessão de browser (mesmo ramal não pode registrar duas
// vezes ao mesmo tempo). WebphoneProvider é montado uma vez no layout do dashboard
// (routes/dashboard.tsx); tanto o widget flutuante quanto o Painel do Agente
// (routes/dashboard/atendimento.tsx) consomem o mesmo estado via useWebphone() abaixo -
// nunca chamar useWebphoneState() diretamente fora daqui.
function useWebphoneState() {
    const { user } = useAuth()
    const enabled = !!user?.extensionId

    const [registered, setRegistered] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
    const [callState, setCallState] = useState<SoftphoneCallState>("idle")
    const [remoteIdentity, setRemoteIdentity] = useState<string | null>(null)
    const [micError, setMicError] = useState<string | null>(null)
    const [muted, setMuted] = useState(false)
    const [held, setHeld] = useState(false)
    const [transferring, setTransferring] = useState(false)
    const [callStartedAt, setCallStartedAt] = useState<number | null>(null)
    const [attendedState, setAttendedState] = useState<AttendedTransferState>("idle")
    const [attendedRemoteIdentity, setAttendedRemoteIdentity] = useState<string | null>(null)

    const userAgentRef = useRef<UserAgent | null>(null)
    const registererRef = useRef<Registerer | null>(null)
    const sessionRef = useRef<Session | null>(null)
    const consultSessionRef = useRef<Session | null>(null)
    // true só quando foi o próprio startAttendedTransfer que colocou a chamada em espera - o
    // cancelamento só retoma automaticamente nesse caso, nunca desfazendo um hold manual prévio
    const heldForAttendedRef = useRef(false)
    const audioElRef = useRef<HTMLAudioElement | null>(null)
    // não é o <audio ref={audioElRef}> da mídia remota (esse toca o stream RTP da chamada
    // estabelecida) - toque de entrada não tem stream nenhum ainda, é só um mp3 local em loop
    const ringtoneRef = useRef<HTMLAudioElement | null>(null)
    const [ringtoneVolume, setRingtoneVolumeState] = useState(loadRingtoneVolume)
    if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio("/ringtone.mp3")
        ringtoneRef.current.loop = true
        ringtoneRef.current.volume = ringtoneVolume
    }

    const stopRingtone = useCallback(() => {
        const el = ringtoneRef.current
        if (!el) return
        el.pause()
        el.currentTime = 0
    }, [])

    // nunca deixa passar do piso - controle de UI é só um slider "baixo <-> alto", zerar de
    // verdade não é uma opção (senão o agente perde o toque de uma ligação entrante)
    const setRingtoneVolume = useCallback((next: number) => {
        const clamped = Math.min(1, Math.max(RINGTONE_MIN_VOLUME, next))
        if (ringtoneRef.current) ringtoneRef.current.volume = clamped
        setRingtoneVolumeState(clamped)
        try {
            window.localStorage.setItem(RINGTONE_VOLUME_STORAGE_KEY, String(clamped))
        } catch {
            // localStorage indisponível - só não persiste entre sessões
        }
    }, [])

    const resetConsult = useCallback(() => {
        consultSessionRef.current = null
        heldForAttendedRef.current = false
        setAttendedState("idle")
        setAttendedRemoteIdentity(null)
    }, [])

    const resetCall = useCallback(() => {
        sessionRef.current = null
        setCallState("idle")
        setRemoteIdentity(null)
        setMuted(false)
        setHeld(false)
        setTransferring(false)
        setCallStartedAt(null)
        if (audioElRef.current) audioElRef.current.srcObject = null
        stopRingtone()
        // chamada principal terminou (ex: cliente desligou) com uma consulta em andamento -
        // a perna de consulta fica órfã, sem sentido mantê-la viva
        endSession(consultSessionRef.current)
        resetConsult()
    }, [resetConsult, stopRingtone])

    const bindSession = useCallback(
        (session: Session, direction: "incoming" | "outgoing") => {
            sessionRef.current = session
            setRemoteIdentity(
                session.remoteIdentity.displayName || session.remoteIdentity.uri.user || null
            )
            setCallState(direction === "incoming" ? "ringing" : "calling")
            // toca em loop enquanto a chamada tocar pra nós - reject()/accept() do usuário e
            // cancelamento/timeout do lado de quem ligou convergem pro mesmo stateChange abaixo,
            // então parar ali (Established ou Terminated) cobre os três casos sem duplicar lógica
            if (direction === "incoming") ringtoneRef.current?.play().catch(() => {})

            session.stateChange.addListener((state: SessionState) => {
                if (session !== sessionRef.current) return
                if (state === SessionState.Established) {
                    stopRingtone()
                    setCallState("in-call")
                    setCallStartedAt(Date.now())
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
        [resetCall, stopRingtone]
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
                fail(`Não foi possível abrir o WebSocket (${server}) - veja o console pro erro completo`)
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
                fail("Falha ao enviar REGISTER - veja o console pro erro completo")
            }
        }

        setup()

        return () => {
            disposed = true
            // sem isso, desmontar o provider (logout, ramal desvinculado) com uma ligação em
            // curso derruba o transporte sem nunca mandar BYE - o Asterisk/o outro lado ficam
            // com o dialog pendurado até o timeout de RTP, chamada "fantasma" com áudio vivo
            void (async () => {
                await endSession(sessionRef.current)
                await endSession(consultSessionRef.current)
                await registererRef.current?.unregister().catch(() => {})
                await userAgentRef.current?.stop().catch(() => {})
                userAgentRef.current = null
                registererRef.current = null
            })()
        }
    }, [enabled, bindSession])

    // F5/fechar aba/navegar pra fora do domínio: o React nunca chega a rodar o cleanup acima
    // (o JS morre no meio), então sem isso a ligação em curso não recebe BYE nenhum - some da
    // tela mas continua com áudio de verdade rolando no Asterisk. "beforeunload" só avisa e
    // NUNCA desliga por si (senão um F5 cancelado no prompt já teria derrubado a ligação de
    // verdade); o BYE de fato só sai no "pagehide", que só dispara quando a saída é confirmada.
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!sessionRef.current && !consultSessionRef.current) return
            event.preventDefault()
            event.returnValue = ""
        }
        const handlePageHide = () => {
            endSession(sessionRef.current)
            endSession(consultSessionRef.current)
        }
        window.addEventListener("beforeunload", handleBeforeUnload)
        window.addEventListener("pagehide", handlePageHide)
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload)
            window.removeEventListener("pagehide", handlePageHide)
        }
    }, [])

    const ensureMic = useCallback(async () => {
        if (!window.isSecureContext) {
            setMicError(MIC_INSECURE_CONTEXT_MESSAGE)
            return false
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach((t) => t.stop())
            setMicError(null)
            return true
        } catch (err) {
            const name = err instanceof DOMException ? err.name : ""
            if (name === "NotAllowedError" || name === "PermissionDeniedError") {
                setMicError(MIC_DENIED_MESSAGE)
            } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
                setMicError(MIC_NOT_FOUND_MESSAGE)
            } else {
                setMicError(MIC_GENERIC_MESSAGE)
            }
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
        await endSession(sessionRef.current)
    }, [])

    const toggleMute = useCallback(() => {
        const sdh = asWebSdh(sessionRef.current)
        if (!sdh) return
        setMuted((prev) => {
            sdh.enableSenderTracks(prev)
            return !prev
        })
    }, [])

    // Reaproveitado pelo toggle manual de hold e pelo início/cancelamento de transferência
    // assistida (que precisa segurar a chamada original programaticamente) - retorna se conseguiu
    const setHold = useCallback(async (next: boolean) => {
        const session = sessionRef.current
        if (!session || session.state !== SessionState.Established) return false
        try {
            await session.invite({
                sessionDescriptionHandlerOptions: { hold: next } as Web.SessionDescriptionHandlerOptions,
            })
            setHeld(next)
            return true
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[webphone] falha ao (re)colocar em espera", err)
            return false
        }
    }, [])

    const toggleHold = useCallback(async () => {
        await setHold(!held)
    }, [held, setHold])

    const transfer = useCallback(async (target: string) => {
        const session = sessionRef.current
        const userAgent = userAgentRef.current
        if (!session || !userAgent || session.state !== SessionState.Established) return
        if (!target.trim()) return
        const uri = UserAgent.makeURI(`sip:${target}@${userAgent.configuration.uri.host}`)
        if (!uri) return
        setTransferring(true)
        try {
            await session.refer(uri)
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[webphone] falha ao transferir", err)
        } finally {
            setTransferring(false)
        }
    }, [])

    // Transferência assistida: segura a chamada principal, disca uma 2ª sessão de consulta pro
    // ramal destino, e só depois de falar com ele o agente decide completar (refer com Replaces)
    // ou cancelar (desliga a consulta e retoma a chamada original).
    const startAttendedTransfer = useCallback(
        async (target: string) => {
            const userAgent = userAgentRef.current
            const primary = sessionRef.current
            if (!userAgent || !primary || primary.state !== SessionState.Established) return
            if (attendedState !== "idle" || !target.trim()) return

            const wasHeld = held
            if (!wasHeld && !(await setHold(true))) return
            heldForAttendedRef.current = !wasHeld

            const uri = UserAgent.makeURI(`sip:${target}@${userAgent.configuration.uri.host}`)
            if (!uri) {
                if (heldForAttendedRef.current) await setHold(false)
                heldForAttendedRef.current = false
                return
            }

            const inviter = new Inviter(userAgent, uri)
            consultSessionRef.current = inviter
            setAttendedState("calling")
            setAttendedRemoteIdentity(target)

            inviter.stateChange.addListener((state: SessionState) => {
                if (inviter !== consultSessionRef.current) return
                if (state === SessionState.Established) {
                    setAttendedState("in-call")
                    setAttendedRemoteIdentity(
                        inviter.remoteIdentity.displayName || inviter.remoteIdentity.uri.user || target
                    )
                } else if (state === SessionState.Terminated) {
                    const shouldResumeHold = heldForAttendedRef.current
                    resetConsult()
                    if (shouldResumeHold) setHold(false)
                }
            })

            // invite() pode rejeitar antes de qualquer stateChange pra Terminated (ex: falha de
            // mídia local) - sem esse catch a consulta ficaria presa em "calling" pra sempre
            await inviter.invite().catch(() => {
                if (inviter !== consultSessionRef.current) return
                const shouldResumeHold = heldForAttendedRef.current
                resetConsult()
                if (shouldResumeHold) setHold(false)
            })
        },
        [attendedState, held, resetConsult, setHold]
    )

    const completeAttendedTransfer = useCallback(async () => {
        const primary = sessionRef.current
        const consult = consultSessionRef.current
        if (!primary || !consult) return
        if (primary.state !== SessionState.Established || consult.state !== SessionState.Established)
            return
        // sucesso: a ligação segue bridgeada no Asterisk sem o agente, retomar hold local não
        // faz sentido - zera antes pra não disparar resume-hold quando a consulta terminar
        heldForAttendedRef.current = false
        try {
            await primary.refer(consult)
            // Sem BYE manual aqui: depois do REFER+Replaces aceito, é o Asterisk quem encerra
            // as duas pernas do agente ao concluir a troca das bridges (Local/_attended@transfer
            // ;1/;2). refer() resolve só com o 202 Accepted, antes da troca terminar - um BYE
            // nosso nesse meio tempo derruba a perna de consulta cedo demais e o Asterisk falha
            // com "Transfer failed probably due to an early hangup".
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[webphone] falha ao completar transferência assistida", err)
        } finally {
            resetConsult()
        }
    }, [resetConsult])

    const cancelAttendedTransfer = useCallback(async () => {
        const consult = consultSessionRef.current
        const shouldResumeHold = heldForAttendedRef.current
        resetConsult()
        await endSession(consult)
        if (shouldResumeHold) await setHold(false)
    }, [resetConsult, setHold])

    const sendDtmf = useCallback((tone: string) => {
        const sdh = asWebSdh(sessionRef.current)
        if (!sdh || sessionRef.current?.state !== SessionState.Established) return
        sdh.sendDtmf(tone)
    }, [])

    const registrationStatus: WebphoneRegistrationStatus = unavailable
        ? "error"
        : registered
          ? "registered"
          : "connecting"

    return {
        enabled,
        registered,
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
        retryMic: ensureMic,
    }
}

type WebphoneContextValue = ReturnType<typeof useWebphoneState>

const WebphoneContext = createContext<WebphoneContextValue | null>(null)

export function WebphoneProvider({ children }: { children: React.ReactNode }) {
    const value = useWebphoneState()
    return (
        <WebphoneContext.Provider value={value}>
            {children}
        </WebphoneContext.Provider>
    )
}

export function useWebphone() {
    const ctx = useContext(WebphoneContext)
    if (!ctx) throw new Error("useWebphone must be used within WebphoneProvider")
    return ctx
}
