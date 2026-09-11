import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { validateEnv } from '../../config/env'
import { withDialplanLock } from './dialplan-file.repository'

const env = validateEnv()

// musiconhold.conf real do Asterisk já vem com a classe [default] de fábrica (pacote asterisk-moh-*,
// ou o fallback interno do res_musiconhold quando o arquivo nem existe) - nunca sobrescrito aqui,
// só um #tryinclude apontado pro nosso arquivo gerenciado é garantido no final do arquivo, mesma
// estratégia de ensureBaseDialplanIncluded (extensions.conf, ver base-dialplan.repository.ts) -
// preserva 100% do conteúdo original, só acrescenta o que falta.
export const MUSICONHOLD_CONF_PATH = `${env.ASTERISK_CONF_DIR}/musiconhold.conf`
export const BASE_MUSICONHOLD_PATH = `${env.ASTERISK_CONF_DIR}/sofon-managed-moh.conf`
const BASE_MUSICONHOLD_INCLUDE = '#tryinclude "sofon-managed-moh.conf"'

// Ao contrário de sofon-managed.conf (dialplan), não define nenhuma classe própria - só materializa
// o #tryinclude de musiconhold-extra/*.conf (ver destinations/musiconhold.repository.ts). [default]
// e qualquer classe manual do servidor continuam intocadas.
const BASE_MUSICONHOLD_CONTENT = `; AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
; Gerado por Sofon PABX (src/asterisk/dialplan/base-musiconhold.repository.ts).
; Sobrescrito sempre que ensureBaseMusiconhold() detectar drift (arquivo ausente ou com
; conteúdo diferente do esperado).

#tryinclude "musiconhold-extra/*.conf"
`

async function writeBaseMusiconhold() {
    await mkdir(dirname(BASE_MUSICONHOLD_PATH), { recursive: true })
    const tmpPath = `${BASE_MUSICONHOLD_PATH}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, BASE_MUSICONHOLD_CONTENT, 'utf8')
    await rename(tmpPath, BASE_MUSICONHOLD_PATH)
}

// Acrescenta só o include ausente ao final do musiconhold.conf real do Asterisk, preservando
// integralmente [default] e qualquer classe cadastrada manualmente. Se o arquivo nem existir ainda,
// cria um mínimo com [general] + o include - o Asterisk usa um [default] interno mesmo sem
// arquivo, então isso não quebra o fallback nativo.
async function ensureBaseMusiconholdIncluded(): Promise<boolean> {
    const current = await readFile(MUSICONHOLD_CONF_PATH, 'utf8').catch(() => null)
    if (current?.match(/^\s*#tryinclude\s+"?sofon-managed-moh\.conf"?\s*$/mi)) return false

    const content = current == null
        ? `[general]\n\n${BASE_MUSICONHOLD_INCLUDE}\n`
        : `${current.trimEnd()}\n\n; Sofon PABX, classes MOH gerenciadas\n${BASE_MUSICONHOLD_INCLUDE}\n`
    await mkdir(dirname(MUSICONHOLD_CONF_PATH), { recursive: true })
    const tmpPath = `${MUSICONHOLD_CONF_PATH}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tmpPath, content, 'utf8')
    await rename(tmpPath, MUSICONHOLD_CONF_PATH)
    return true
}

// Idempotente, mesmo padrão de ensureBaseDialplan() - chamado no boot (ensureStaticAsteriskConfig)
// e reusado pelo resync explícito. Retorna true só quando efetivamente reescreveu algo.
export async function ensureBaseMusiconhold(): Promise<boolean> {
    return withDialplanLock('sofon-managed-moh', async () => {
        const current = await readFile(BASE_MUSICONHOLD_PATH, 'utf8').catch(() => null)
        const baseRewritten = current !== BASE_MUSICONHOLD_CONTENT
        if (baseRewritten) await writeBaseMusiconhold()
        const includeAdded = await ensureBaseMusiconholdIncluded()
        return baseRewritten || includeAdded
    })
}
