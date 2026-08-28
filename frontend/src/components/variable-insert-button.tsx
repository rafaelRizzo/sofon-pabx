"use client"

import { ASTERISK_VARIABLES, insertToken } from "@/lib/asterisk-variables"
import { VariablePickerCombobox } from "@/components/variable-picker-combobox"

type Props = {
    onSelect: (token: string) => void
    companyId?: string
    className?: string
}

// Botão compacto pra inserir uma variável de canal Asterisk documentada (ver asterisk-variables.ts)
// ou do catálogo customizado da empresa (companyId, ver use-variable-catalog.ts) na posição do
// cursor de um campo que aceita placeholder {{VAR}} - usar junto de useVariableInsert. O token
// inserido é {{VAR}} (insertToken), diferente de VariableRefPickerButton, que substitui o campo
// inteiro pelo nome cru da variável. Comportamento real do picker vive em variable-picker-combobox.tsx.
export function VariableInsertButton({ onSelect, companyId, className }: Props) {
    return (
        <VariablePickerCombobox
            companyId={companyId}
            nativeVariables={ASTERISK_VARIABLES}
            onSelect={onSelect}
            toToken={insertToken}
            tooltip="Inserir variável"
            align="end"
            className={className}
        />
    )
}
