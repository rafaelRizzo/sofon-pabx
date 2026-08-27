import { createFileRoute } from "@tanstack/react-router"


import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { CompanyFilter } from "@/components/company-filter"
import { PageHeader } from "@/components/page-header"
import { RealtimeExtensionCards } from "@/components/Monitoring/realtime-extension-cards"
import { RealtimeTrunkCards } from "@/components/Monitoring/realtime-trunk-cards"
import { RealtimeQueuesPanel } from "@/components/Monitoring/realtime-queues-panel"
import { RealtimeStats } from "@/components/Monitoring/realtime-stats"
import {
    ExtensionSortToggle,
    type ExtensionSortBy,
} from "@/components/Monitoring/extension-sort-toggle"
import { HideOfflineSwitch } from "@/components/Monitoring/hide-offline-switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanies } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import {
    useRealtimeExtensions,
    useRealtimeQueues,
    useRealtimeTrunks,
} from "@/hooks/use-realtime"

function MonitoringPage() {
    const { companies } = useCompanies()
    const [companyId, setCompanyId] = useCompanyFilter()
    const [extensionSortBy, setExtensionSortBy] =
        useState<ExtensionSortBy>("number")
    const [hideOffline, setHideOffline] = useState(false)

    const { extensions, loading: loadingExtensions } =
        useRealtimeExtensions(companyId)
    const { trunks, loading: loadingTrunks } = useRealtimeTrunks(companyId)
    const { queues, loading: loadingQueues } = useRealtimeQueues(companyId)

    // alias é sempre numérico (2-6 dígitos, validação do backend) - comparação numérica direta
    const sortedExtensions = useMemo(
        () =>
            [...extensions].sort((a, b) =>
                extensionSortBy === "number"
                    ? Number(a.alias) - Number(b.alias)
                    : a.name.localeCompare(b.name)
            ),
        [extensions, extensionSortBy]
    )

    const visibleExtensions = useMemo(
        () =>
            hideOffline
                ? sortedExtensions.filter((e) => e.presence !== "offline")
                : sortedExtensions,
        [sortedExtensions, hideOffline]
    )

    // distingue "sem ramal cadastrado" de "todos offline e ocultos" - sem isso o hideOffline some
    // com a lista inteira e parece que a empresa não tem nenhum ramal
    const extensionsEmptyMessage =
        hideOffline && sortedExtensions.length > 0
            ? "Todos os ramais estão offline (ocultos)"
            : undefined

    const sortedTrunks = useMemo(
        () => [...trunks].sort((a, b) => a.name.localeCompare(b.name)),
        [trunks]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Monitoramento em tempo real"
                description="Presença de ramais/troncos e estado das filas, atualizado via eventos AMI"
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
                    Selecione uma empresa para ver o status ao vivo.
                </p>
            ) : (
                <>
                    <RealtimeStats
                        extensions={extensions}
                        queues={queues}
                        loading={loadingExtensions || loadingQueues}
                    />

                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">
                                Visão geral
                            </TabsTrigger>
                            <TabsTrigger value="extensions">
                                Ramais
                                <Badge
                                    variant="outline"
                                    className="h-4 min-w-4 rounded-full px-1 text-[0.5625rem]"
                                >
                                    {extensions.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="trunks">
                                Troncos
                                <Badge
                                    variant="outline"
                                    className="h-4 min-w-4 rounded-full px-1 text-[0.5625rem]"
                                >
                                    {sortedTrunks.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="queues">
                                Filas
                                <Badge
                                    variant="outline"
                                    className="h-4 min-w-4 rounded-full px-1 text-[0.5625rem]"
                                >
                                    {queues.length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent
                            value="overview"
                            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
                        >
                            <div className="flex flex-col gap-6">
                                <section className="flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h2 className="text-sm font-semibold">
                                            Ramais
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <HideOfflineSwitch
                                                checked={hideOffline}
                                                onCheckedChange={setHideOffline}
                                            />
                                            <ExtensionSortToggle
                                                value={extensionSortBy}
                                                onValueChange={
                                                    setExtensionSortBy
                                                }
                                            />
                                        </div>
                                    </div>
                                    <RealtimeExtensionCards
                                        extensions={visibleExtensions}
                                        queues={queues}
                                        loading={loadingExtensions}
                                        companySelected={!!companyId}
                                        emptyMessage={extensionsEmptyMessage}
                                    />
                                </section>

                                <Separator />

                                <section className="flex flex-col gap-3">
                                    <h2 className="text-sm font-semibold">
                                        Troncos
                                    </h2>
                                    <RealtimeTrunkCards
                                        trunks={sortedTrunks}
                                        loading={loadingTrunks}
                                        companySelected={!!companyId}
                                    />
                                </section>
                            </div>

                            <section className="flex flex-col gap-3">
                                <h2 className="text-sm font-semibold">Filas</h2>
                                <RealtimeQueuesPanel
                                    queues={queues}
                                    extensions={extensions}
                                    loading={loadingQueues}
                                    companySelected={!!companyId}
                                />
                            </section>
                        </TabsContent>

                        <TabsContent
                            value="extensions"
                            className="flex flex-col gap-3"
                        >
                            <div className="flex flex-wrap items-center justify-end gap-3">
                                <HideOfflineSwitch
                                    checked={hideOffline}
                                    onCheckedChange={setHideOffline}
                                />
                                <ExtensionSortToggle
                                    value={extensionSortBy}
                                    onValueChange={setExtensionSortBy}
                                />
                            </div>
                            <RealtimeExtensionCards
                                extensions={visibleExtensions}
                                queues={queues}
                                loading={loadingExtensions}
                                companySelected={!!companyId}
                                emptyMessage={extensionsEmptyMessage}
                            />
                        </TabsContent>

                        <TabsContent value="trunks">
                            <RealtimeTrunkCards
                                trunks={sortedTrunks}
                                loading={loadingTrunks}
                                companySelected={!!companyId}
                            />
                        </TabsContent>

                        <TabsContent value="queues">
                            <RealtimeQueuesPanel
                                queues={queues}
                                extensions={extensions}
                                loading={loadingQueues}
                                companySelected={!!companyId}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}

export const Route = createFileRoute("/dashboard/monitoring")({
  component: MonitoringPage,
})
