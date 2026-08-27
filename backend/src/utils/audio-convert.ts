import { AppError } from './errors/app.error'
import { validateEnv } from '../config/env'

const env = validateEnv()
let activeConversions = 0
const waitingConversions: Array<() => void> = []

const acquireConversionSlot = async () => {
    if (activeConversions < env.AUDIO_CONVERSION_CONCURRENCY) {
        activeConversions++
        return
    }
    if (waitingConversions.length >= env.AUDIO_CONVERSION_QUEUE_MAX) {
        throw new AppError('Audio conversion queue is full. Try again shortly.', 429)
    }
    await new Promise<void>((resolve) => waitingConversions.push(resolve))
    activeConversions++
}

const releaseConversionSlot = () => {
    activeConversions--
    waitingConversions.shift()?.()
}

// slin 16-bit PCM mono @ 8kHz - combina qualidade (lossless) com compatibilidade total
// com os codecs configurados nas trunks (ulaw/alaw, sempre 8kHz), sem resample na chamada.
// Usa sox (já instalado por setups/install-asterisk.sh) - detecta o formato de entrada
// pela extensão/header, então funciona para wav/mp3/ogg/flac etc.
export async function convertToAsteriskWav(inputPath: string, outputPath: string) {
    await acquireConversionSlot()
    try {
        const proc = Bun.spawn(
            ['sox', inputPath, '-r', '8000', '-c', '1', '-b', '16', '-e', 'signed-integer', outputPath],
            { stdout: 'pipe', stderr: 'pipe' },
        )
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            proc.kill()
        }, env.AUDIO_CONVERSION_TIMEOUT_MS)
        const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
        clearTimeout(timeout)
        if (timedOut) {
            throw new AppError('Audio conversion exceeded the allowed processing time', 422)
        }
        if (exitCode !== 0) {
            throw new AppError(`Falha ao converter áudio: ${stderr.trim() || 'sox retornou erro'}`, 422)
        }
    } finally {
        releaseConversionSlot()
    }
}
