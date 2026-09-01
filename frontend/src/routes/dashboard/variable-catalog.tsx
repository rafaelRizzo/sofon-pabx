import { createFileRoute } from "@tanstack/react-router"

import { useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { VariableCatalogFormDialog } from "@/components/VariableCatalog/variable-catalog-form-dialog"
import { VariableCatalogTable } from "@/components/VariableCatalog/variable-catalog-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useVariableCatalog, type Variable } from "@/hooks/use-variable-catalog"

const NO_PREFIX_GROUP = "Sem prefixo"

// Agrupa pelo token antes do primeiro "_" (convenção de nome já usada em toda variável gerada
// automaticamente - IXCsoft, IVR, Definir Variável) - só rearranjo client-side, sem tocar no
// modelo/backend. Nomes sem "_" caem num grupo à parte, sempre por último.
function groupByPrefix(variables: Variable[]) {
    const groups = new Map<string, Variable[]>()
    for (const v of variables) {
        const separatorIndex = v.name.indexOf("_")
        const prefix = separatorIndex > 0 ? v.name.slice(0, separatorIndex) : NO_PREFIX_GROUP
        const group = groups.get(prefix) ?? []
        group.push(v)
        groups.set(prefix, group)
    }
    return [...groups.entries()]
        .sort(([a], [b]) => {
            if (a === NO_PREFIX_GROUP) return 1
            if (b === NO_PREFIX_GROUP) return -1
            return a.localeCompare(b)
        })
        .map(([prefix, vars]) => [prefix, vars.sort((a, b) => a.name.localeCompare(b.name))] as const)
}

function VariableCatalogPage() {
    const { companies } = useCompanies()
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        variables,
        loading,
        filter,
        setFilter,
        createVariable,
        updateVariable,
        deleteVariable,
    } = useVariableCatalog(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editVariable, setEditVariable] = useState<Variable | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Variable | null>(null)

    const groups = useMemo(() => groupByPrefix(variables), [variables])
    const showGroups = !loading && !!companyFilter && variables.length > 0

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteVariable(deleteTarget.id)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Catálogo de Variáveis"
                description="Nomes de variável declarados pela empresa, usados por URAs e Definir Variável"
            >
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon />
                    Nova variável
                </Button>
            </PageHeader>

            <FilterBar>
                <Input
                    placeholder="Buscar por nome..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full md:max-w-sm"
                />
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
            </FilterBar>

            {showGroups ? (
                <>
                    <p className="text-xs text-muted-foreground">
                        Agrupado pelo prefixo do nome (antes do primeiro &quot;_&quot;) -{" "}
                        {variables.length} variáve{variables.length === 1 ? "l" : "is"} em{" "}
                        {groups.length} grupo{groups.length === 1 ? "" : "s"}.
                    </p>
                    <Accordion multiple>
                        {groups.map(([prefix, groupVariables]) => (
                            <AccordionItem key={prefix} value={prefix}>
                                <AccordionTrigger>
                                    <span>
                                        {prefix}{" "}
                                        <span className="text-muted-foreground">
                                            ({groupVariables.length})
                                        </span>
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="px-0 pb-0">
                                    <VariableCatalogTable
                                        variables={groupVariables}
                                        companies={companies}
                                        loading={false}
                                        companySelected
                                        onEdit={setEditVariable}
                                        onDelete={setDeleteTarget}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </>
            ) : (
                <VariableCatalogTable
                    variables={variables}
                    companies={companies}
                    loading={loading}
                    companySelected={!!companyFilter}
                    onEdit={setEditVariable}
                    onDelete={setDeleteTarget}
                />
            )}

            {createOpen && (
                <VariableCatalogFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    variable={null}
                    companies={companies}
                    defaultCompanyId={companyFilter}
                    onSave={createVariable}
                />
            )}

            {editVariable && (
                <VariableCatalogFormDialog
                    open={!!editVariable}
                    onOpenChange={(open) => !open && setEditVariable(null)}
                    variable={editVariable}
                    companies={companies}
                    onSave={(form) =>
                        updateVariable(editVariable.id, {
                            name: form.name,
                            description: form.description,
                        })
                    }
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar variável"
                itemName={deleteTarget?.name}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export const Route = createFileRoute("/dashboard/variable-catalog")({
    component: VariableCatalogPage,
})
