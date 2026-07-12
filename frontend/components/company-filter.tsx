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

interface CompanyFilterProps {
    companies: CompanyFilterOption[]
    value: string | undefined
    onValueChange: (companyId: string | undefined) => void
    placeholder?: string
    className?: string
}

export function CompanyFilter({
    companies,
    value,
    onValueChange,
    placeholder = "Buscar empresa...",
    className = "w-56",
}: CompanyFilterProps) {
    return (
        <Combobox<CompanyFilterOption>
            items={companies}
            value={companies.find((c) => c.id === value) ?? null}
            itemToStringLabel={(c) => c.name}
            isItemEqualToValue={(a, b) => a.id === b.id}
            onValueChange={(company) => onValueChange(company?.id)}
        >
            <ComboboxInput placeholder={placeholder} className={className} />
            <ComboboxContent>
                <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                <ComboboxList>
                    {(company: CompanyFilterOption) => (
                        <ComboboxItem key={company.id} value={company}>
                            {company.name}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
