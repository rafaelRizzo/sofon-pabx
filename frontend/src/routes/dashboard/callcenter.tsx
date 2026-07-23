import { createFileRoute } from "@tanstack/react-router"


import { CompanyFilter } from "@/components/company-filter"
import { PageHeader } from "@/components/page-header"
import { AgentScopesPanel } from "@/components/Callcenter/agent-scopes-panel"
import { CallRatingsPanel } from "@/components/Callcenter/call-ratings-panel"
import { RoutingRulesPanel } from "@/components/Callcenter/routing-rules-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"

function CallcenterPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Callcenter"
                description="Elegibilidade de agentes, regras de prioridade e notas de atendimento por empresa"
            />

            <CompanyFilter
                companies={companies}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Selecione uma empresa..."
                className="w-72"
            />

            {!companyId ? (
                <p className="text-sm text-muted-foreground">
                    Selecione uma empresa para gerenciar o callcenter.
                </p>
            ) : (
                <Tabs defaultValue="agent-scopes">
                    <TabsList>
                        <TabsTrigger value="agent-scopes">
                            Elegibilidade de agentes
                        </TabsTrigger>
                        <TabsTrigger value="routing-rules">
                            Regras de prioridade
                        </TabsTrigger>
                        <TabsTrigger value="ratings">
                            Notas de atendimento
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="agent-scopes">
                        <AgentScopesPanel companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="routing-rules">
                        <RoutingRulesPanel companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="ratings">
                        <CallRatingsPanel companyId={companyId} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    )
}

export const Route = createFileRoute("/dashboard/callcenter")({
  component: CallcenterPage,
})
