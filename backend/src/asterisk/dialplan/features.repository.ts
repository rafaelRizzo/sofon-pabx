import { readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { validateEnv } from '../../config/env'
import { withDialplanLock } from './dialplan-file.repository'

const env = validateEnv()
export const FEATURES_CONF_PATH = `${env.ASTERISK_CONF_DIR}/features.conf`

async function readFeaturesConf(): Promise<string | null> {
    return readFile(FEATURES_CONF_PATH, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
    })
}

async function atomicWrite(content: string): Promise<void> {
    const tmpPath = `${FEATURES_CONF_PATH}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, content, 'utf8')
    await rename(tmpPath, FEATURES_CONF_PATH)
}

// Remove somente o atalho de transferência cega legado, preservando qualquer configuração manual
// do cliente em features.conf. O arquivo já existe em toda instalação feita pelo instalador.
const BLIND_XFER = /^[ \t]*blindxfer\s*=>\s*#1(?:[ \t]*(?:;.*)?)?\r?\n?/gmi

export async function removeBlindTransferFeature(): Promise<boolean> {
    return withDialplanLock('features-conf', async () => {
        const current = await readFeaturesConf()
        if (current == null) return false

        const updated = current.replace(BLIND_XFER, '')
        if (updated === current) return false

        await atomicWrite(updated)
        return true
    })
}

// Tempo entre dígitos ao discar o destino de uma transferência DTMF (depois do #1/*2) - valor
// original do instalador (3s) estourava com discagem manual normal de um ramal de 4-6 dígitos,
// tratando cada dígito isolado como tentativa própria (ver histórico de debug: "1002" virava
// "1@transfer" + "0@transfer" etc, cada um "does not exist"). Não cria a linha se não existir -
// o instalador sempre a cria dentro de [general], então ausência aqui é sinal de outra coisa.
const TRANSFER_DIGIT_TIMEOUT = /^([ \t]*transferdigittimeout\s*=\s*)(\d+)/mi
const TRANSFER_DIGIT_TIMEOUT_VALUE = '8'

export async function bumpTransferDigitTimeout(): Promise<boolean> {
    return withDialplanLock('features-conf', async () => {
        const current = await readFeaturesConf()
        if (current == null) return false

        const match = current.match(TRANSFER_DIGIT_TIMEOUT)
        if (!match || match[2] === TRANSFER_DIGIT_TIMEOUT_VALUE) return false

        const updated = current.replace(TRANSFER_DIGIT_TIMEOUT, `$1${TRANSFER_DIGIT_TIMEOUT_VALUE}`)
        await atomicWrite(updated)
        return true
    })
}
