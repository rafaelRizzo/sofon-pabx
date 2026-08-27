"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { VariableCatalogFormDialog } from "@/components/VariableCatalog/variable-catalog-form-dialog"
import { useCompanies } from "@/hooks/use-companies"
import { useVariableCatalog, type Variable } from "@/hooks/use-variable-catalog"

type Props = {
    companyId: string
    value: string | null
    onChange: (name: string | null) => void
}

// Select do Catálogo de Variáveis (frontend/src/routes/dashboard/variable-catalog.tsx) - usado
// onde antes havia um <Input> de texto livre pra nome de variável (URA modo coleta, Definir
// Variável). O botão "+" cria uma variável nova sem sair do form pai (mesmo espírito do "Criar X"
// de branch-connect-popover.tsx), selecionando ela automaticamente ao salvar.
export function VariableCombobox({ companyId, value, onChange }: Props) {
    const { companies } = useCompanies()
    const { variables, createVariable } = useVariableCatalog(companyId)
    const [createOpen, setCreateOpen] = useState(false)

    const selected = variables.find((v) => v.name === value) ?? null

    return (
        <>
            <div className="flex gap-1.5">
                <Combobox<Variable>
                    items={variables}
                    value={selected}
                    itemToStringLabel={(v) => v.name}
                    isItemEqualToValue={(a, b) => a.name === b.name}
                    onValueChange={(v) => onChange(v?.name ?? null)}
                >
                    <ComboboxInput
                        placeholder="Buscar variável..."
                        className="flex-1"
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>
                            Nenhuma variável cadastrada para essa empresa
                        </ComboboxEmpty>
                        <ComboboxList>
                            {(v: Variable) => (
                                <ComboboxItem key={v.id} value={v}>
                                    {v.name}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!companyId}
                    onClick={() => setCreateOpen(true)}
                    aria-label="Criar variável"
                >
                    <PlusIcon />
                </Button>
            </div>

            {createOpen && (
                <VariableCatalogFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    variable={null}
                    companies={companies}
                    defaultCompanyId={companyId}
                    onSave={async (form) => {
                        const ok = await createVariable(form)
                        if (ok) onChange(form.name)
                        return ok
                    }}
                />
            )}
        </>
    )
}
