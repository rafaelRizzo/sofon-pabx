"use client"

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"

type CompanyFilterOption = { id: string; name: string }

// sentinela local: nunca colide com um cuid2 real, representa "sem filtro" na lista
const ALL_COMPANIES: CompanyFilterOption = { id: "", name: "Todas as empresas" }

interface CompanyFilterProps {
    companies: CompanyFilterOption[]
    value: string | undefined
    onValueChange: (companyId: string | undefined) => void
    placeholder?: string
    className?: string
    // exibe a opção "Todas as empresas"; só faz sentido em telas onde ver
    // tudo de uma vez é útil (ex: dids, users); demais telas exigem uma empresa
    showAllOption?: boolean
}

export function CompanyFilter({
    companies,
    value,
    onValueChange,
    placeholder = "Buscar empresa...",
    className = "w-56",
    showAllOption = false,
}: CompanyFilterProps) {
    const items = showAllOption ? [ALL_COMPANIES, ...companies] : companies
    // null (não undefined) no fallback: mantém o Combobox sempre controlado desde
    // o 1º render; Base UI trata `value` ausente (undefined) como não-controlado
    const selected =
        companies.find((c) => c.id === value) ??
        (showAllOption ? ALL_COMPANIES : null)

    return (
        <Combobox<CompanyFilterOption>
            items={items}
            value={selected}
            itemToStringLabel={(c) => c.name}
            isItemEqualToValue={(a, b) => a.id === b.id}
            onValueChange={(company) =>
                onValueChange(company && company.id ? company.id : undefined)
            }
        >
            <ComboboxInput placeholder={placeholder} className={className} />
            <ComboboxContent>
                <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                <ComboboxList>
                    {(company: CompanyFilterOption) => (
                        <ComboboxItem
                            key={company.id || "all"}
                            value={company}
                        >
                            {company.name}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
