"use client"

import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

// Espelha AUDIT_LOG_MODELS de backend/src/modules/audit-logs/schemas/audit-log.schema.ts
export const AUDIT_LOG_MODELS = [
    "Company", "User", "Did", "Extension", "Queue", "QueueMember", "Trunk",
    "OutboundRoute", "TimeGroup", "TimeCondition", "HolidayGroup", "InboundRoute",
    "Announcement", "Audio", "IvrMenu", "RequestTemplate", "VariableSet",
    "VariableCondition", "IntegrationCredential", "IxcNode", "Flow",
    "AgentCompanyScope", "RoutingRule",
] as const

export type AuditLogModel = (typeof AUDIT_LOG_MODELS)[number]

export const AUDIT_LOG_MODEL_LABEL: Record<AuditLogModel, string> = {
    Company: "Empresa",
    User: "Usuário",
    Did: "DID",
    Extension: "Ramal",
    Queue: "Fila",
    QueueMember: "Membro de fila",
    Trunk: "Tronco",
    OutboundRoute: "Rota de saída",
    TimeGroup: "Grupo de horário",
    TimeCondition: "Condição de horário",
    HolidayGroup: "Feriados",
    InboundRoute: "Rota de entrada",
    Announcement: "Anúncio",
    Audio: "Áudio",
    IvrMenu: "URA",
    RequestTemplate: "Template de requisição",
    VariableSet: "Variável",
    VariableCondition: "Condição de variável",
    IntegrationCredential: "Credencial de integração",
    IxcNode: "Nó IXCsoft",
    Flow: "Flow",
    AgentCompanyScope: "Escopo de agente",
    RoutingRule: "Regra de roteamento",
}

export type AuditLogAction = "CREATE" | "UPDATE" | "DELETE"

export const ACTION_LABEL: Record<AuditLogAction, string> = {
    CREATE: "Criado",
    UPDATE: "Atualizado",
    DELETE: "Excluído",
}

export type AuditLog = {
    id: string
    actorId: string
    actorName: string | null
    ip: string | null
    action: AuditLogAction
    model: string
    recordId: string | null
    companyId: string | null
    before: Record<string, unknown> | unknown[] | null
    after: Record<string, unknown> | unknown[] | null
    createdAt: string
}

export type AuditLogFilters = {
    model?: AuditLogModel
    action?: AuditLogAction
    startDate?: string
    endDate?: string
}

const DEFAULT_LIMIT = 10

function filterParams(companyId: string | undefined, filters: AuditLogFilters, extra?: object) {
    return {
        companyId: companyId || undefined,
        model: filters.model || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        ...extra,
    }
}

export function useAuditLogs(
    companyId: string | undefined,
    filters: AuditLogFilters = {},
    limit = DEFAULT_LIMIT
) {
    const [page, setPage] = useState(1)
    const { model, action, startDate, endDate } = filters

    // qualquer mudança de filtro/empresa reseta a navegação para a 1ª página
    useEffect(() => {
        setPage(1)
    }, [companyId, model, action, startDate, endDate])

    const { data, isLoading: loading } = useQuery({
        queryKey: ["audit-logs", companyId, filters, page, limit],
        queryFn: async () => {
            const { data } = await api.get("/audit-logs", {
                params: filterParams(companyId, filters, { page, limit }),
            })
            return { records: data.records as AuditLog[], total: data.total as number }
        },
        placeholderData: keepPreviousData,
    })

    return {
        records: data?.records ?? [],
        total: data?.total ?? 0,
        limit,
        loading,
        page,
        totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
        goToPage: setPage,
    }
}
