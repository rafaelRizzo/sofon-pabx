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
import { FormatterNodeFormDialog } from "@/components/FormatterNodes/formatter-node-form-dialog"
import {
    useFormatterNodes,
    toFormatterNodeCreationDto,
    type FormatterNode,
} from "@/hooks/use-formatter-nodes"
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
    // true = comportamento de sempre (chama a API de update na hora). false = auto save desligado -
    // editar um recurso já existente no backend não chama a API, só enfileira a mudança (ver
    // onDraftUpdate) pra aplicar de verdade quando o usuário clicar em "Salvar" no canvas.
    autoSave: boolean
    // presente quando `id` é um id de rascunho local (recurso criado nesta mesma sessão sem auto
    // save, ainda não existe no backend) - o form dialog edita esse objeto em vez de buscar por
    // GET/:id (que daria 404, o registro não existe). onSave nesse caso vira onDraftSave.
    draftEntity?: unknown
    // chamado no lugar do update real quando draftEntity está presente - só reescreve o rascunho
    // local, sem nenhuma chamada de rede
    onDraftSave?: (form: unknown) => void
    // chamado no lugar do update real quando autoSave=false e o recurso já é real (existia antes
    // deste draft) - enfileira a atualização pra aplicar no clique de "Salvar"
    onDraftUpdate?: (form: unknown) => void
    // dispara depois de salvar com sucesso - o canvas usa isso pra refazer o grafo (o nome exibido
    // no nó, ou uma conexão feita através do próprio form, pode ter mudado)
    onSaved: () => void
    // recebe o DTO de criação montado a partir do registro carregado no editor (não do buffer não
    // salvo do form) - o histórico de undo/redo do canvas usa isso pra poder recriar o recurso caso
    // o usuário desfaça a exclusão (ver flow-canvas.tsx)
    onDeleteResource?: (creationDto: unknown) => void
}

// Busca genérica por id - usada por todo tipo que não tem hook de leitura única própria. A resposta
// HTTP de GET/:id sempre é { success, message, <recurso singular> } (ver CLAUDE.md do backend), daí
// extrair a única chave que não é success/message em vez de repetir o nome em cada branch abaixo.
// Expõe `loading` separado de `entity` porque `entity` começa null tanto durante o fetch quanto se
// ele falhar - sem essa distinção, o *-form-dialog não tem como saber que ainda é edição (e não
// criação) enquanto o registro não chega (ver isEdit nesses dialogs).
// queryKey [apiPath, id] cacheia/dedupa por cache do TanStack Query - StrictMode não dispara mais
// o GET duas vezes (a segunda montagem do efeito só lê o resultado em voo da primeira).
// `enabled=false` pula o fetch por completo - usado quando `id` é um id de rascunho local (ver
// draftEntity acima), que nunca existiu no backend e daria 404.
function useEntityById<T>(apiPath: string, id: string, enabled = true) {
    const { data: entity = null, isLoading: loading } = useQuery({
        queryKey: [apiPath, id],
        enabled,
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

    return { entity, loading: enabled && loading }
}

// Duplo-clique num nó do canvas (ver flow-node.tsx) abre o form de edição do módulo dono do
// registro - reaproveita o mesmo dialog usado na tela de listagem daquele recurso, sem recriar
// formulário nenhum. O grafo do canvas só traz {type,id,name} (ver flow-canvas.tsx), então busca o
// registro completo por id ao abrir. extension/flow usam hook próprio de leitura única (o resto
// passa por useEntityById acima).
// IMPORTANTE: montar com `key={`${type}:${id}`}` no chamador - mesma regra de CreateNodeDialog:
// os hooks chamados aqui variam por `type`/`id` num switch, só seguro porque o componente é
// remontado do zero a cada nó diferente, não re-renderizado com as props mudando.
export function EditNodeDialog({
    type,
    id,
    open,
    onOpenChange,
    companyId,
    companies,
    autoSave,
    draftEntity,
    onDraftSave,
    onDraftUpdate,
    onSaved,
    onDeleteResource,
}: Props) {
    const isDraft = draftEntity !== undefined
    switch (type) {
        case "announcement": {
            const { entity, loading } = useEntityById<Announcement>(
                NODE_TYPE_CONFIG.announcement.apiPath,
                id,
                !isDraft
            )
            const { updateAnnouncement } = useAnnouncements()
            const resolved = isDraft ? (draftEntity as Announcement) : entity
            return (
                <AnnouncementFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    announcement={resolved}
                    loading={loading}
                    companyId={companyId}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toAnnouncementCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateIvrMenu } = useIvr()
            const resolved = isDraft ? (draftEntity as IvrMenu) : entity
            return (
                <IvrMenuFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    ivrMenu={resolved}
                    companies={companies}
                    flowNodeMode
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toIvrMenuCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateQueue } = useQueues()
            const [membersOpen, setMembersOpen] = useState(false)
            const resolved = isDraft ? (draftEntity as Queue) : entity
            return (
                <>
                    <QueueFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        queue={resolved}
                        loading={loading}
                        companies={companies}
                        onDelete={() =>
                            onDeleteResource?.(
                                isDraft
                                    ? draftEntity
                                    : entity && toQueueCreationDto(entity)
                            )
                        }
                        onManageMembers={
                            isDraft ? undefined : () => setMembersOpen(true)
                        }
                        onSave={async (form) => {
                            if (isDraft) {
                                onDraftSave?.(form)
                                onSaved()
                                return true
                            }
                            if (!autoSave) {
                                onDraftUpdate?.(form)
                                onSaved()
                                return true
                            }
                            const ok = await updateQueue(id, form)
                            if (ok) onSaved()
                            return ok
                        }}
                    />
                    {!isDraft && (
                        <QueueMembersSheet
                            open={membersOpen}
                            onOpenChange={setMembersOpen}
                            queue={entity}
                        />
                    )}
                </>
            )
        }
        case "request": {
            const { entity, loading } = useEntityById<RequestTemplate>(
                NODE_TYPE_CONFIG.request.apiPath,
                id,
                !isDraft
            )
            const { updateRequestTemplate } = useRequestTemplates()
            const resolved = isDraft ? (draftEntity as RequestTemplate) : entity
            return (
                <RequestTemplateFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    requestTemplate={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity &&
                                  toRequestTemplateCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateIxcNode } = useIxcNodes()
            const resolved = isDraft ? (draftEntity as IxcNode) : entity
            return (
                <IxcNodeFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    ixcNode={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toIxcNodeCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
                        const ok = await updateIxcNode(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "formatter": {
            const { entity, loading } = useEntityById<FormatterNode>(
                NODE_TYPE_CONFIG.formatter.apiPath,
                id,
                !isDraft
            )
            const { updateFormatterNode } = useFormatterNodes()
            const resolved = isDraft ? (draftEntity as FormatterNode) : entity
            return (
                <FormatterNodeFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    formatterNode={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toFormatterNodeCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
                        const ok = await updateFormatterNode(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "timecondition": {
            const { entity, loading } = useEntityById<TimeCondition>(
                NODE_TYPE_CONFIG.timecondition.apiPath,
                id,
                !isDraft
            )
            const { updateTimeCondition } = useTimeConditions()
            const resolved = isDraft ? (draftEntity as TimeCondition) : entity
            return (
                <TimeConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    timeCondition={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toTimeConditionCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateHolidayGroup } = useHolidayGroups()
            const resolved = isDraft ? (draftEntity as HolidayGroup) : entity
            return (
                <HolidayGroupFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    holidayGroup={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toHolidayGroupCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateVariableSet } = useVariables()
            const resolved = isDraft ? (draftEntity as VariableSet) : entity
            return (
                <VariableSetFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableSet={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity && toVariableSetCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
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
                id,
                !isDraft
            )
            const { updateVariableCondition } = useVariableConditions()
            const resolved = isDraft
                ? (draftEntity as VariableCondition)
                : entity
            return (
                <VariableConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableCondition={resolved}
                    loading={loading}
                    companies={companies}
                    onDelete={() =>
                        onDeleteResource?.(
                            isDraft
                                ? draftEntity
                                : entity &&
                                  toVariableConditionCreationDto(entity)
                        )
                    }
                    onSave={async (form) => {
                        if (isDraft) {
                            onDraftSave?.(form)
                            onSaved()
                            return true
                        }
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
                        const ok = await updateVariableCondition(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "extension": {
            // ExtensionFormDialog aceita o id direto (string) e busca o registro internamente -
            // não precisa passar por useEntityById. Nunca é um recurso de rascunho (creatable:false
            // no canvas, ver node-types.ts), só a edição em si pode ficar pendente de auto save.
            const { updateExtension } = useExtensions()
            return (
                <ExtensionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    extension={id}
                    companies={companies}
                    onUpdate={async (form) => {
                        if (!autoSave) {
                            onDraftUpdate?.(form)
                            onSaved()
                            return true
                        }
                        const ok = await updateExtension(id, form)
                        if (ok) onSaved()
                        return ok
                    }}
                />
            )
        }
        case "flow": {
            // nó "flow" = referência a outro Flow dentro deste - edita só nome/empresa aqui; a
            // cadeia de nós desse flow aninhado se edita abrindo ele mesmo (ver /dashboard/flows/:id).
            // Também nunca é um recurso de rascunho (creatable:false), só a edição pode ficar pendente.
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
                        if (!autoSave) {
                            onDraftUpdate?.({ name: form.name })
                            onSaved()
                            return true
                        }
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
