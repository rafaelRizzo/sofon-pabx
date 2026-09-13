import { resolve, join } from 'path'
import { validateEnv } from '../../config/env'

const env = validateEnv()

// Path absoluto: env aceita relativo (default) ou absoluto (produção, apontando pro volume montado)
const AVATAR_STORAGE_DIR = resolve(env.AVATAR_STORAGE_DIR)

export const avatarDir = () => AVATAR_STORAGE_DIR

// 1 arquivo por usuário - path determinístico, upload novo sempre substitui o anterior no mesmo path
export const avatarPath = (userId: string) => join(AVATAR_STORAGE_DIR, `${userId}.webp`)

// arquivo temporário no MESMO diretório final (nunca em os.tmpdir()) - rename() só é atômico
// dentro do mesmo filesystem; se o storage dir for um volume separado (produção), um tmp em
// /tmp causaria EXDEV (cross-device link) no rename
export const avatarTmpPath = (userId: string, suffix: string) => join(AVATAR_STORAGE_DIR, `.tmp-${userId}-${suffix}.webp`)
