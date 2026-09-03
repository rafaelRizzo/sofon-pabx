import { mkdir } from 'fs/promises'
import { join } from 'path'
import { AppError } from '../../utils/errors/app.error'

const EXTRACT_TIMEOUT_MS = 60_000

const runTar = async (args: string[]): Promise<string> => {
    const proc = Bun.spawn(['tar', ...args], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => proc.kill(), EXTRACT_TIMEOUT_MS)
    const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ])
    clearTimeout(timeout)
    if (exitCode !== 0) throw new AppError(`Falha ao processar arquivo de backup: ${stderr.trim() || 'tar failed'}`, 422)
    return stdout
}

/**
 * Localiza, dentro de um .tar/.tar.gz/.tgz, o primeiro membro cujo caminho bate com `pattern`,
 * extrai só ele (sem descompactar o backup inteiro - que pode ter GBs de gravação/voicemail) pra
 * `destDir`, e retorna o path final do arquivo extraído.
 */
export const extractMember = async (archivePath: string, destDir: string, pattern: RegExp, notFoundMessage: string) => {
    const listing = await runTar(['-tf', archivePath])
    const entry = listing
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0 && pattern.test(line))

    if (!entry) throw new AppError(notFoundMessage, 422)

    await mkdir(destDir, { recursive: true })
    await runTar(['-xf', archivePath, '-C', destDir, entry])
    return join(destDir, entry)
}
