import { createFileRoute } from "@tanstack/react-router"

import { CompanyFilter } from "@/components/company-filter"
import { PageHeader } from "@/components/page-header"
import { CallRatingsPanel } from "@/components/Callcenter/call-ratings-panel"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"

function CallRatingsPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Notas de atendimento"
                description="Pesquisa de satisfação pós-atendimento por empresa"
            />

            <CompanyFilter
                companies={companies}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Selecione uma empresa..."
                className="w-full md:w-72"
            />

            {!companyId ? (
                <p className="text-sm text-muted-foreground">
                    Selecione uma empresa para ver as notas de atendimento.
                </p>
            ) : (
                <CallRatingsPanel companyId={companyId} />
            )}
        </div>
    )
}

export const Route = createFileRoute("/dashboard/call-ratings")({
    component: CallRatingsPage,
})
