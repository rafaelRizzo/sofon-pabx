import { createFileRoute } from "@tanstack/react-router"

import { DashboardInfraCards } from "@/components/Dashboard/dashboard-infra-cards"
import { DashboardOverviewCards } from "@/components/Dashboard/dashboard-overview-cards"
import { CompanyFilter } from "@/components/company-filter"
import { FilterBar } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/hooks/use-auth"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import { useDashboardInfra, useDashboardOverview } from "@/hooks/use-dashboard"

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useCompanyFilter()

  const { overview, loading: overviewLoading } = useDashboardOverview(companyId)
  const { infra, loading: infraLoading } = useDashboardInfra(isAdmin)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="Visão geral do Sofon PABX"
      />

      <FilterBar>
        <CompanyFilter
          companies={companies}
          value={companyId}
          onValueChange={setCompanyId}
        />
      </FilterBar>

      <DashboardOverviewCards overview={overview} loading={overviewLoading} />

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Infraestrutura
          </h2>
          <DashboardInfraCards infra={infra} loading={infraLoading} />
        </div>
      )}
    </div>
  )
}
