"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"
import { AnnouncementFormDialog } from "@/components/Announcements/announcement-form-dialog"
import {
    useAnnouncements,
    toAnnouncementCreationDto,
    type Announcement,
} from "@/hooks/use-announcements"
import { QueueFormDialog } from "@/components/Queues/queue-form-dialog"
import { QueueMembersSheet } from "@/components/Queues/queue-members-sheet"
import { useQueues, toQueueCreationDto, type Queue } from "@/hooks/use-queues"
import { RequestTemplateFormDialog } from "@/components/RequestTemplates/request-template-form-dialog"
import {
    useRequestTemplates,
    toRequestTemplateCreationDto,
    type RequestTemplate,
} from "@/hooks/use-request-templates"
import { IxcNodeFormDialog } from "@/components/Ixc/ixc-node-form-dialog"
import {
    useIxcNodes,
    toIxcNodeCreationDto,
    type IxcNode,
} from "@/hooks/use-ixc-nodes"
import { TimeConditionFormDialog } from "@/components/TimeConditions/time-condition-form-dialog"
import {
    useTimeConditions,
    toTimeConditionCreationDto,
    type TimeCondition,
} from "@/hooks/use-time-conditions"
import { HolidayGroupFormDialog } from "@/components/HolidayGroups/holiday-group-form-dialog"
import {
    useHolidayGroups,
    toHolidayGroupCreationDto,
    type HolidayGroup,
} from "@/hooks/use-holiday-groups"
import { VariableSetFormDialog } from "@/components/Variables/variable-set-form-dialog"
import {
    useVariables,
    toVariableSetCreationDto,
    type VariableSet,
} from "@/hooks/use-variables"
import { VariableConditionFormDialog } from "@/components/VariableConditions/variable-condition-form-dialog"
import {
    useVariableConditions,
    toVariableConditionCreationDto,
    type VariableCondition,
} from "@/hooks/use-variable-conditions"
import { ExtensionFormDialog } from "@/components/Extensions/extension-form-dialog"
import { useExtensions } from "@/hooks/use-extensions"
import { FlowFormDialog } from "@/components/Flows/flow-form-dialog"
import { useFlow, useFlows } from "@/hooks/use-flows"
import { IvrMenuFormDialog } from "@/components/Ivr/ivr-menu-form-dialog"
import {
    toIvrMenuCreationDto,
    useIvr,
    type IvrMenu,
} from "@/hooks/use-ivr"
import type { Company } from "@/hooks/use-companies"
import {
    NODE_TYPE_CONFIG,
    type CanvasNodeType,
} from "@/components/Flows/node-types"

type Props = {
    type: CanvasNodeType
    id: string
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    companies: Company[]
    // dispara depois de salvar com sucesso — o canvas usa isso pra refazer o grafo (o nome exibido
    // no nó, ou uma conexão feita através do próprio form, pode ter mudado)
    onSaved: () => void
    // recebe o DTO de criação montado a partir do registro carregado no editor (não do buffer não
    // salvo do form) — o histórico de undo/redo do canvas usa isso pra poder recriar o recurso caso
    // o usuário desfaça a exclusão (ver flow-canvas.tsx)
    onDeleteResource?: (creationDto: unknown) => void
}

// Busca genérica por id — usada por todo tipo que não tem hook de leitura única própria. A resposta
// HTTP de GET/:id sempre é { success, message, <recurso singular> } (ver CLAUDE.md do backend), daí
// extrair a única chave que não é success/message em vez de repetir o nome em cada branch abaixo.
// Expõe `loading` separado de `entity` porque `entity` começa null tanto durante o fetch quanto se
// ele falhar — sem essa distinção, o *-form-dialog não tem como saber que ainda é edição (e não
// criação) enquanto o registro não chega (ver isEdit nesses dialogs).
// queryKey [apiPath, id] cacheia/dedupa por cache do TanStack Query — StrictMode não dispara mais
// o GET duas vezes (a segunda montagem do efeito só lê o resultado em voo da primeira).
function useEntityById<T>(apiPath: string, id: string) {
    const { data: entity = null, isLoading: loading } = useQuery({
        queryKey: [apiPath, id],
        queryFn: async (): Promise<T | null> => {
            try {
                const { data } = await api.get(`/${apiPath}/${id}`)
                const key = Object.keys(data).find(
                    (k) => k !== "success" && k !== "message"
                )
                return key ? data[key] : null
            } catch (err) {
                toast.error(apiError(err, "Erro ao buscar registro"))
                throw err
            }
        },
    })

    return { entity, loading }
}

// Duplo-clique num nó do canvas (ver flow-node.tsx) abre o form de edição do módulo dono do
// registro — reaproveita o mesmo dialog usado na tela de listagem daquele recurso, sem recriar
// formulário nenhum. O grafo do canvas só traz {type,id,name} (ver flow-canvas.tsx), então busca o
// registro completo por id ao abrir. extension/flow usam hook próprio de leitura única (o resto
// passa por useEntityById acima).
// IMPORTANTE: montar com `key={`${type}:${id}`}` no chamador — mesma regra de CreateNodeDialog:
// os hooks chamados aqui variam por `type`/`id` num switch, só seguro porque o componente é
// remontado do zero a cada nó diferente, não re-renderizado com as props mudando.
export function EditNodeDialog({
    type,
    id,
    open,
    onOpenChange,
    companyId,
    companies,
    onSaved,
    onDeleteResource,
}: Props) {
    switch (type) {
        case "announcement": {
            const { entity, loading } = useEntityById<Announcement>(
                NODE_TYPE_CONFIG.announcement.apiPath,
                id
            )
            const { updateAnnouncement } = useAnnouncements()
            return (
                <AnnouncementFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    announcement={entity}
                    loading={loading}
                    companyId={companyId}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toAnnouncementCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateAnnouncement(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "ivr": {
            const { entity } = useEntityById<IvrMenu>(
                NODE_TYPE_CONFIG.ivr.apiPath,
                id
            )
            const { updateIvrMenu } = useIvr()
            return (
                <IvrMenuFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    ivrMenu={entity}
                    companies={companies}
                    flowNodeMode
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toIvrMenuCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateIvrMenu(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "queue": {
            const { entity, loading } = useEntityById<Queue>(
                NODE_TYPE_CONFIG.queue.apiPath,
                id
            )
            const { updateQueue } = useQueues()
            const [membersOpen, setMembersOpen] = useState(false)
            return (
                <>
                    <QueueFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        queue={entity}
                        loading={loading}
                        companies={companies}
                        onDelete={() =>
                            entity &&
                            onDeleteResource?.(toQueueCreationDto(entity))
                        }
                        onManageMembers={() => setMembersOpen(true)}
                        onSave={async (form) => {
                            const ok = await updateQueue(id, form)
                            if (ok) onSaved()
                            return ok
                        }}
                    />
                    <QueueMembersSheet
                        open={membersOpen}
                        onOpenChange={setMembersOpen}
                        queue={entity}
                    />
                </>
            )
        }
        case "request": {
            const { entity, loading } = useEntityById<RequestTemplate>(
                NODE_TYPE_CONFIG.request.apiPath,
                id
            )
            const { updateRequestTemplate } = useRequestTemplates()
            return (
                <RequestTemplateFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    requestTemplate={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toRequestTemplateCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateRequestTemplate(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "ixc": {
            const { entity, loading } = useEntityById<IxcNode>(
                NODE_TYPE_CONFIG.ixc.apiPath,
                id
            )
            const { updateIxcNode } = useIxcNodes()
            return (
                <IxcNodeFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    ixcNode={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity && onDeleteResource?.(toIxcNodeCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateIxcNode(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "timecondition": {
            const { entity, loading } = useEntityById<TimeCondition>(
                NODE_TYPE_CONFIG.timecondition.apiPath,
                id
            )
            const { updateTimeCondition } = useTimeConditions()
            return (
                <TimeConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    timeCondition={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toTimeConditionCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateTimeCondition(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "holiday": {
            const { entity, loading } = useEntityById<HolidayGroup>(
                NODE_TYPE_CONFIG.holiday.apiPath,
                id
            )
            const { updateHolidayGroup } = useHolidayGroups()
            return (
                <HolidayGroupFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    holidayGroup={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toHolidayGroupCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateHolidayGroup(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "variable-set": {
            const { entity, loading } = useEntityById<VariableSet>(
                NODE_TYPE_CONFIG["variable-set"].apiPath,
                id
            )
            const { updateVariableSet } = useVariables()
            return (
                <VariableSetFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableSet={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(toVariableSetCreationDto(entity))
                    }
                    onSave={async (form) => {
                        const ok = await updateVariableSet(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "variable-condition": {
            const { entity, loading } = useEntityById<VariableCondition>(
                NODE_TYPE_CONFIG["variable-condition"].apiPath,
                id
            )
            const { updateVariableCondition } = useVariableConditions()
            return (
                <VariableConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableCondition={entity}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        entity &&
                        onDeleteResource?.(
                            toVariableConditionCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        const ok = await updateVariableCondition(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "extension": {
            // ExtensionFormDialog aceita o id direto (string) e busca o registro internamente —
            // não precisa passar por useEntityById
            const { updateExtension } = useExtensions()
            return (
                <ExtensionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    extension={id}
                    companies={companies}
                    onUpdate={async (form) => {
                        const ok = await updateExtension(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "flow": {
            // nó "flow" = referência a outro Flow dentro deste — edita só nome/empresa aqui; a
            // cadeia de nós desse flow aninhado se edita abrindo ele mesmo (ver /dashboard/flows/:id)
            const { flow, loading } = useFlow(id)
            const { updateFlow } = useFlows()
            return (
                <FlowFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    flow={flow}
                    loading={loading}
                    companies={companies}
                    onSave={async (form) => {
                        const ok = await updateFlow(id, { name: form.name })
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        default:
            return null
    }
}
