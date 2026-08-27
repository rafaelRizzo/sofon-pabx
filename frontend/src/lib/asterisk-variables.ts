// Catálogo documentado de variáveis de canal Asterisk disponíveis via placeholder {{VAR}} em
// campos resolvidos por AGI GET VARIABLE (Request Templates, nó IXCsoft) - ver
// backend/src/asterisk/transport/agi-server.ts (resolvePlaceholders). Lista curada e fixa (v1):
// cobre só o que já é lido nativamente pelo AGI em qualquer ponto do dialplan, sem depender do
// que um flow específico define (variáveis criadas por nós "Definir variável" não entram aqui).
export type AsteriskVariable = {
    name: string
    description: string
}

export const ASTERISK_VARIABLES: AsteriskVariable[] = [
    { name: "CALLERID(num)", description: "Número de quem está ligando" },
    { name: "CALLERID(name)", description: "Nome de quem está ligando, quando disponível (CNAM)" },
    { name: "EXTEN", description: "Número/ramal discado nesta etapa do dialplan" },
    { name: "UNIQUEID", description: "Identificador único desta chamada no Asterisk" },
]

export function insertToken(variableName: string): string {
    return `{{${variableName}}}`
}
