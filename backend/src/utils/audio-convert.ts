import { AppError } from './errors/app.error'

// slin 16-bit PCM mono @ 8kHz — combina qualidade (lossless) com compatibilidade total
// com os codecs configurados nas trunks (ulaw/alaw, sempre 8kHz), sem resample na chamada.
// Usa sox (já instalado por setups/install-asterisk.sh) — detecta o formato de entrada
// pela extensão/header, então funciona para wav/mp3/ogg/flac etc.
export async function convertToAsteriskWav(inputPath: string, outputPath: string) {
    const proc = Bun.spawn(
        ['sox', inputPath, '-r', '8000', '-c', '1', '-b', '16', '-e', 'signed-integer', outputPath],
        { stdout: 'pipe', stderr: 'pipe' },
    )
    const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
    if (exitCode !== 0) {
        throw new AppError(`Falha ao converter áudio: ${stderr.trim() || 'sox retornou erro'}`, 422)
    }
}
