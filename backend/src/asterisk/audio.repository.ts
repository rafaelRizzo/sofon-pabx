// Reaproveita o dir de sons padrão do Asterisk (astdatadir/sounds), isolado por empresa —
// único lugar que guarda arquivo físico de áudio; Announcement/IvrMenu só referenciam um Audio.id
export const SOUNDS_BASE_DIR = '/var/lib/asterisk/sounds'
export const audioSoundDir = (asteriskId: string) => `${SOUNDS_BASE_DIR}/${asteriskId}`
// sem extensão — appdata do Playback/Read resolve o formato sozinho
export const audioSoundPath = (asteriskId: string, id: string) => `${audioSoundDir(asteriskId)}/${id}`
