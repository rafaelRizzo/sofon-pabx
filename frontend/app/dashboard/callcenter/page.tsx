"use client"

import { useState } from "react"

import { PageHeader } from "@/components/page-header"
import { AgentScopesPanel } from "@/components/Callcenter/agent-scopes-panel"
import { CallRatingsPanel } from "@/components/Callcenter/call-ratings-panel"
import { RoutingRulesPanel } from "@/components/Callcenter/routing-rules-panel"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Company, useCompanies } from "@/hooks/use-companies"

export default function CallcenterPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useState<string>("")

    const selectedCompany = companies.find((c) => c.id === companyId) ?? null

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Callcenter"
                description="Elegibilidade de agentes, regras de prioridade e notas de atendimento por empresa"
            />

            <Combobox<Company>
                items={companies}
                value={selectedCompany}
                itemToStringLabel={(c) => c.name}
                isItemEqualToValue={(a, b) => a.id === b.id}
                onValueChange={(c) => setCompanyId(c?.id ?? "")}
            >
                <ComboboxInput placeholder="Selecione uma empresa..." className="w-72" />
                <ComboboxContent>
                    <ComboboxEmpty>Nenhuma empresa</ComboboxEmpty>
                    <ComboboxList>
                        {(c: Company) => (
                            <ComboboxItem key={c.id} value={c}>
                                {c.name}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>

            {!companyId ? (
                <p className="text-sm text-muted-foreground">
                    Selecione uma empresa para gerenciar o callcenter.
                </p>
            ) : (
                <Tabs defaultValue="agent-scopes">
                    <TabsList>
                        <TabsTrigger value="agent-scopes">Elegibilidade de agentes</TabsTrigger>
                        <TabsTrigger value="routing-rules">Regras de prioridade</TabsTrigger>
                        <TabsTrigger value="ratings">Notas de atendimento</TabsTrigger>
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
