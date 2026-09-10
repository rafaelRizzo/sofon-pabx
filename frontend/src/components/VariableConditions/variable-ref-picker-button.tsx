"use client"

import { VariablePickerCombobox } from "@/components/variable-picker-combobox"
import { type VariableRefPickerButtonProps } from "@/components/VariableConditions/types"

// Variáveis nativas do Asterisk aceitas por SAFE_VARIABLE_REF_REGEX
// (backend/src/schemas/dialplan-safety.ts) além de identificadores simples - não reaproveita
// ASTERISK_VARIABLES de lib/asterisk-variables.ts porque aquela lista é pro mecanismo de
// placeholder {{VAR}} resolvido via AGI (Request Templates/IXCsoft), com um subconjunto diferente
// (ani/rdnis/dnid não são lidos ali, mas são válidos aqui por interpolação direta no dialplan)
const BUILTIN_VARIABLE_REFS = [
    { name: "CALLERID(num)", description: "Número de quem está ligando" },
    {
        name: "CALLERID(name)",
        description: "Nome de quem está ligando, quando disponível (CNAM)",
    },
    {
        name: "CALLERID(ani)",
        description: "ANI - número de origem informado pelo tronco",
    },
    {
        name: "CALLERID(rdnis)",
        description: "Número redirecionador (RDNIS), em chamadas transferidas",
    },
    {
        name: "CALLERID(dnid)",
        description: "Número originalmente discado (DNID)",
    },
    { name: "EXTEN", description: "Número/ramal discado nesta etapa do fluxo" },
    { name: "UNIQUEID", description: "Identificador único desta chamada" },
    {
        name: "DB(family/key)",
        description:
            "Valor salvo no Asterisk DB - edite family/key antes de usar",
    },
]

// Botão que abre um picker de referências de variável válidas pra VariableCondition.rules[].variable
// (mesmas 3 formas aceitas por SAFE_VARIABLE_REF_REGEX: nome do catálogo, CALLERID(...), DB(...)) -
// ao contrário de VariableInsertButton, aqui o clique substitui o valor inteiro do campo pelo nome
// cru da variável (sem {{}}). Comportamento real do picker vive em variable-picker-combobox.tsx.
export function VariableRefPickerButton({ companyId, onSelect, className }: VariableRefPickerButtonProps) {
    return (
        <VariablePickerCombobox
            companyId={companyId}
            nativeVariables={BUILTIN_VARIABLE_REFS}
            onSelect={onSelect}
            disabled={!companyId}
            tooltip="Escolher variável"
            disabledTooltip="Selecione a empresa primeiro"
            align="start"
            className={className}
        />
    )
}
