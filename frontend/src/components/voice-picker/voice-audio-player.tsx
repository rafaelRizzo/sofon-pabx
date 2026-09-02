"use client"

// Porta local (renomeada: AudioPlayerProvider -> VoiceAudioPlayerProvider, useAudioPlayer ->
// useVoiceAudioPlayer) do componente oficial "audio-player" do shadcn/ui (registry
// ui.elevenlabs.io), usado só pelo VoicePicker (ver voice-picker.tsx) pra tocar a prévia da voz
// em hover/click. Trimado: o original também exporta uma progress bar + seletor de velocidade
// (Radix Slider/DropdownMenu) que o VoicePicker não usa - mantido só o provider/hook (estado de
// play/pause/activeItem), que é tudo que o VoicePicker precisa.
import {
    createContext,
    type ReactNode,
    type RefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

// HTMLMediaElement.readyState/networkState (ver MDN) - só os 2 valores usados em isBuffering
// abaixo; `enum` não é permitido aqui (erasableSyntaxOnly no tsconfig deste projeto)
const READY_STATE_HAVE_FUTURE_DATA = 3
const NETWORK_STATE_LOADING = 2

interface VoiceAudioPlayerItem<TData = unknown> {
    id: string | number
    src: string
    data?: TData
}

interface VoiceAudioPlayerApi<TData = unknown> {
    ref: RefObject<HTMLAudioElement | null>
    activeItem: VoiceAudioPlayerItem<TData> | null
    duration: number | undefined
    error: MediaError | null
    isPlaying: boolean
    isBuffering: boolean
    playbackRate: number
    isItemActive: (id: string | number | null) => boolean
    setActiveItem: (item: VoiceAudioPlayerItem<TData> | null) => Promise<void>
    play: (item?: VoiceAudioPlayerItem<TData> | null) => Promise<void>
    pause: () => void
    seek: (time: number) => void
    setPlaybackRate: (rate: number) => void
}

const VoiceAudioPlayerContext =
    createContext<VoiceAudioPlayerApi<unknown> | null>(null)

export function useVoiceAudioPlayer<TData = unknown>(): VoiceAudioPlayerApi<TData> {
    const api = useContext(VoiceAudioPlayerContext) as VoiceAudioPlayerApi<TData> | null
    if (!api) {
        throw new Error(
            "useVoiceAudioPlayer cannot be called outside of VoiceAudioPlayerProvider"
        )
    }
    return api
}

export function VoiceAudioPlayerProvider<TData = unknown>({
    children,
}: {
    children: ReactNode
}) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const itemRef = useRef<VoiceAudioPlayerItem<TData> | null>(null)
    const playPromiseRef = useRef<Promise<void> | null>(null)
    const [readyState, setReadyState] = useState<number>(0)
    const [networkState, setNetworkState] = useState<number>(0)
    const [duration, setDuration] = useState<number | undefined>(undefined)
    const [error, setError] = useState<MediaError | null>(null)
    const [activeItem, _setActiveItem] = useState<VoiceAudioPlayerItem<TData> | null>(
        null
    )
    const [paused, setPaused] = useState(true)
    const [playbackRate, setPlaybackRateState] = useState<number>(1)

    const setActiveItem = useCallback(
        async (item: VoiceAudioPlayerItem<TData> | null) => {
            if (!audioRef.current) return

            if (item?.id === itemRef.current?.id) {
                return
            }
            itemRef.current = item
            const currentRate = audioRef.current.playbackRate
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            if (item === null) {
                audioRef.current.removeAttribute("src")
            } else {
                audioRef.current.src = item.src
            }
            audioRef.current.load()
            audioRef.current.playbackRate = currentRate
        },
        []
    )

    const play = useCallback(
        async (item?: VoiceAudioPlayerItem<TData> | null) => {
            if (!audioRef.current) return

            if (playPromiseRef.current) {
                try {
                    await playPromiseRef.current
                } catch (error) {
                    console.error("Play promise error:", error)
                }
            }

            if (item === undefined) {
                const playPromise = audioRef.current.play()
                playPromiseRef.current = playPromise
                return playPromise
            }
            if (item?.id === activeItem?.id) {
                const playPromise = audioRef.current.play()
                playPromiseRef.current = playPromise
                return playPromise
            }

            itemRef.current = item
            const currentRate = audioRef.current.playbackRate
            if (!audioRef.current.paused) {
                audioRef.current.pause()
            }
            audioRef.current.currentTime = 0
            if (item === null) {
                audioRef.current.removeAttribute("src")
            } else {
                audioRef.current.src = item.src
            }
            audioRef.current.load()
            audioRef.current.playbackRate = currentRate
            const playPromise = audioRef.current.play()
            playPromiseRef.current = playPromise
            return playPromise
        },
        [activeItem]
    )

    const pause = useCallback(async () => {
        if (!audioRef.current) return

        if (playPromiseRef.current) {
            try {
                await playPromiseRef.current
            } catch (e) {
                console.error(e)
            }
        }

        audioRef.current.pause()
        playPromiseRef.current = null
    }, [])

    const seek = useCallback((time: number) => {
        if (!audioRef.current) return
        audioRef.current.currentTime = time
    }, [])

    const setPlaybackRate = useCallback((rate: number) => {
        if (!audioRef.current) return
        audioRef.current.playbackRate = rate
        setPlaybackRateState(rate)
    }, [])

    const isItemActive = useCallback(
        (id: string | number | null) => {
            return activeItem?.id === id
        },
        [activeItem]
    )

    useAnimationFrame(() => {
        if (audioRef.current) {
            _setActiveItem(itemRef.current)
            setReadyState(audioRef.current.readyState)
            setNetworkState(audioRef.current.networkState)
            setDuration(audioRef.current.duration)
            setPaused(audioRef.current.paused)
            setError(audioRef.current.error)
            setPlaybackRateState(audioRef.current.playbackRate)
        }
    })

    const isPlaying = !paused
    const isBuffering =
        readyState < READY_STATE_HAVE_FUTURE_DATA &&
        networkState === NETWORK_STATE_LOADING

    const api = useMemo<VoiceAudioPlayerApi<TData>>(
        () => ({
            ref: audioRef,
            duration,
            error,
            isPlaying,
            isBuffering,
            activeItem,
            playbackRate,
            isItemActive,
            setActiveItem,
            play,
            pause,
            seek,
            setPlaybackRate,
        }),
        [
            duration,
            error,
            isPlaying,
            isBuffering,
            activeItem,
            playbackRate,
            isItemActive,
            setActiveItem,
            play,
            pause,
            seek,
            setPlaybackRate,
        ]
    )

    return (
        <VoiceAudioPlayerContext.Provider value={api as VoiceAudioPlayerApi<unknown>}>
            <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
            {children}
        </VoiceAudioPlayerContext.Provider>
    )
}

type Callback = (delta: number) => void

function useAnimationFrame(callback: Callback) {
    const requestRef = useRef<number | null>(null)
    const previousTimeRef = useRef<number | null>(null)
    const callbackRef = useRef<Callback>(callback)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        const animate = (time: number) => {
            if (previousTimeRef.current !== null) {
                const delta = time - previousTimeRef.current
                callbackRef.current(delta)
            }
            previousTimeRef.current = time
            requestRef.current = requestAnimationFrame(animate)
        }

        requestRef.current = requestAnimationFrame(animate)

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
            previousTimeRef.current = null
        }
    }, [])
}
