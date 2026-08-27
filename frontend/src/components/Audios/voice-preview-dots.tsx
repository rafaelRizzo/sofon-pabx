import type { CSSProperties } from "react"

const DOT_DELAYS = ["0s", "0.15s", "0.3s"]

// Bolinhas que pulsam enquanto a prévia da voz está tocando. Puramente CSS (sem Web Audio API):
// createMediaElementSource/AnalyserNode reroteiam a saída do <audio> inteira pro grafo do Web
// Audio, e se o AudioContext não conseguir dar resume (política de autoplay do navegador, já que
// ele nasceria fora da pilha síncrona do clique) o preview fica mudo mesmo "tocando" - não vale o
// risco pra uma animação decorativa.
export function VoicePreviewDots() {
    return (
        <span className="flex items-center gap-0.5" aria-hidden="true">
            {DOT_DELAYS.map((delay, i) => (
                <span
                    key={i}
                    className="animate-voice-dot size-1 rounded-full bg-current"
                    style={{ "--vd-delay": delay } as CSSProperties}
                />
            ))}
        </span>
    )
}
