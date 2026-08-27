"use client"

import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const BAR_COUNT = 64
const MIN_BAR_HEIGHT_PCT = 12

let sharedAudioContext: AudioContext | null = null
function getAudioContext(): AudioContext {
    if (!sharedAudioContext) {
        const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext
        sharedAudioContext = new Ctor()
    }
    return sharedAudioContext
}

// Amostra a amplitude média em BAR_COUNT blocos do primeiro canal - decodificação é só pra
// desenhar as barras, a reprodução em si roda por fora, no <audio> nativo (currentTime/play/pause)
async function extractPeaks(src: string): Promise<number[]> {
    const buffer = await fetch(src).then((r) => r.arrayBuffer())
    const audioBuffer = await getAudioContext().decodeAudioData(buffer)
    const raw = audioBuffer.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(raw.length / BAR_COUNT))

    const peaks: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) {
        const start = i * blockSize
        let sum = 0
        for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j] ?? 0)
        peaks.push(sum / blockSize)
    }
    const max = Math.max(...peaks, 0.0001)
    return peaks.map((p) => p / max)
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

type Props = {
    src: string
    autoPlay?: boolean
    className?: string
}

export function AudioWaveform({ src, autoPlay, className }: Props) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const barsRef = useRef<HTMLDivElement | null>(null)
    const [peaks, setPeaks] = useState<number[] | null>(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        let cancelled = false
        setPeaks(null)
        extractPeaks(src)
            .then((result) => !cancelled && setPeaks(result))
            // visualização é cosmética - se decodificar falhar, toca normal com barras neutras
            .catch(() => !cancelled && setPeaks(Array(BAR_COUNT).fill(0.4)))
        return () => {
            cancelled = true
        }
    }, [src])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const onTimeUpdate = () => setCurrentTime(audio.currentTime)
        const onLoadedMetadata = () => setDuration(audio.duration)
        const onPlay = () => setPlaying(true)
        const onPauseOrEnd = () => setPlaying(false)

        audio.addEventListener("timeupdate", onTimeUpdate)
        audio.addEventListener("loadedmetadata", onLoadedMetadata)
        audio.addEventListener("play", onPlay)
        audio.addEventListener("pause", onPauseOrEnd)
        audio.addEventListener("ended", onPauseOrEnd)
        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate)
            audio.removeEventListener("loadedmetadata", onLoadedMetadata)
            audio.removeEventListener("play", onPlay)
            audio.removeEventListener("pause", onPauseOrEnd)
            audio.removeEventListener("ended", onPauseOrEnd)
        }
    }, [src])

    function togglePlay() {
        const audio = audioRef.current
        if (!audio) return
        if (playing) audio.pause()
        else void audio.play()
    }

    function seekToClientX(clientX: number) {
        const audio = audioRef.current
        const bars = barsRef.current
        if (!audio || !bars || !duration) return
        const rect = bars.getBoundingClientRect()
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
        audio.currentTime = ratio * duration
        setCurrentTime(audio.currentTime)
    }

    const progress = duration > 0 ? currentTime / duration : 0
    const bars = peaks ?? Array(BAR_COUNT).fill(0.3)

    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioRef} src={src} autoPlay={autoPlay} className="hidden" />

            <Button
                type="button"
                size="icon"
                onClick={togglePlay}
                className="size-9 shrink-0 rounded-full bg-indigo-500 text-white hover:bg-indigo-500/90 dark:bg-indigo-400 dark:hover:bg-indigo-400/90"
            >
                {playing ? <PauseIcon /> : <PlayIcon />}
                <span className="sr-only">{playing ? "Pausar" : "Tocar"}</span>
            </Button>

            <div
                ref={barsRef}
                onClick={(e) => seekToClientX(e.clientX)}
                role="slider"
                aria-label="Progresso da gravação"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
                onKeyDown={(e) => {
                    const audio = audioRef.current
                    if (!audio) return
                    if (e.key === "ArrowRight") audio.currentTime = Math.min(duration, audio.currentTime + 5)
                    if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5)
                }}
                className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-0.75 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
                {bars.map((peak, i) => {
                    const played = i / BAR_COUNT <= progress
                    const heightPct = Math.max(MIN_BAR_HEIGHT_PCT, peak * 100)
                    return (
                        <span
                            key={i}
                            style={{ height: `${heightPct}%` }}
                            className={cn(
                                "min-w-0 flex-1 rounded-full transition-[height,background-color] duration-150",
                                !peaks && "animate-pulse",
                                played
                                    ? "bg-indigo-500 dark:bg-indigo-400"
                                    : "bg-muted-foreground/30 dark:bg-white/25"
                            )}
                        />
                    )
                })}
            </div>

            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    )
}
