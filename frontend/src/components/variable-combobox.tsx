"use client"

import { useEffect, useState } from "react"
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

// Espelha VARIABLE_NAME_REGEX de backend/src/schemas/variable-name.schema.ts - só pra decidir
// se vale a pena oferecer o quick-create; a validação de verdade continua no backend.
const VARIABLE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/

type Props = {
    companyId: string
    value: string | null
    onChange: (name: string | null) => void
}

// Select do Catálogo de Variáveis (frontend/src/routes/dashboard/variable-catalog.tsx) - usado
// onde antes havia um <Input> de texto livre pra nome de variável (URA modo coleta, Definir
// Variável, mapeamento de nó IXCsoft). O botão "+" abre o form completo (com descrição); digitar
// um nome que não existe ainda e apertar Enter (ou clicar na linha "Criar variável") cria na hora
// só com o nome, sem sair do combobox - mesmo espírito do "Criar X" de branch-connect-popover.tsx.
export function VariableCombobox({ companyId, value, onChange }: Props) {
    const { companies } = useCompanies()
    const { variables, createVariable } = useVariableCatalog(companyId)
    const [createOpen, setCreateOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [creating, setCreating] = useState(false)

    const selected = variables.find((v) => v.name === value) ?? null

    // inputValue é controlado (precisa ser, pro quick-create ler o texto digitado), então o texto
    // exibido não segue mais o valor selecionado sozinho como no Combobox não-controlado - sincroniza
    // manualmente sempre que o valor externo mudar (montagem, seleção no dropdown ou quick-create).
    useEffect(() => {
        setQuery(value ?? "")
    }, [value])

    const trimmedQuery = query.trim()
    const hasExactMatch = variables.some(
        (v) => v.name.toLowerCase() === trimmedQuery.toLowerCase()
    )
    const canQuickCreate =
        !!companyId &&
        trimmedQuery.length > 0 &&
        !hasExactMatch &&
        VARIABLE_NAME_REGEX.test(trimmedQuery)

    async function quickCreate(name: string) {
        if (creating) return
        setCreating(true)
        const ok = await createVariable({ name, companyId })
        setCreating(false)
        if (ok) {
            onChange(name)
            setQuery(name)
        }
    }

    return (
        <>
            <div className="flex gap-1.5">
                <Combobox<Variable>
                    items={variables}
                    value={selected}
                    inputValue={query}
                    onInputValueChange={setQuery}
                    itemToStringLabel={(v) => v.name}
                    isItemEqualToValue={(a, b) => a.name === b.name}
                    onValueChange={(v) => onChange(v?.name ?? null)}
                >
                    <ComboboxInput
                        placeholder="Buscar variável..."
                        className="flex-1"
                        disabled={creating}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && canQuickCreate) {
                                e.preventDefault()
                                quickCreate(trimmedQuery)
                            }
                        }}
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>
                            {canQuickCreate ? (
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs/relaxed text-foreground hover:bg-accent hover:text-accent-foreground"
                                    disabled={creating}
                                    onClick={() => quickCreate(trimmedQuery)}
                                >
                                    <PlusIcon className="size-3.5 shrink-0" />
                                    Criar variável "{trimmedQuery}"
                                </button>
                            ) : (
                                "Nenhuma variável cadastrada para essa empresa"
                            )}
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
