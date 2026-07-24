"use client"

import { AnnouncementFormDialog } from "@/components/Announcements/announcement-form-dialog"
import { useAnnouncements } from "@/hooks/use-announcements"
import { QueueFormDialog } from "@/components/Queues/queue-form-dialog"
import { useQueues } from "@/hooks/use-queues"
import { RequestTemplateFormDialog } from "@/components/RequestTemplates/request-template-form-dialog"
import { useRequestTemplates } from "@/hooks/use-request-templates"
import { TimeConditionFormDialog } from "@/components/TimeConditions/time-condition-form-dialog"
import { useTimeConditions } from "@/hooks/use-time-conditions"
import { HolidayGroupFormDialog } from "@/components/HolidayGroups/holiday-group-form-dialog"
import { useHolidayGroups } from "@/hooks/use-holiday-groups"
import { VariableSetFormDialog } from "@/components/Variables/variable-set-form-dialog"
import { useVariables } from "@/hooks/use-variables"
import { VariableConditionFormDialog } from "@/components/VariableConditions/variable-condition-form-dialog"
import { useVariableConditions } from "@/hooks/use-variable-conditions"
import { IvrMenuFormDialog } from "@/components/Ivr/ivr-menu-form-dialog"
import { useIvr } from "@/hooks/use-ivr"
import type { Company } from "@/hooks/use-companies"
import type { CanvasNodeType } from "@/components/Flows/node-types"
import type { DestinationOption } from "@/components/RouteDestination/route-destination-field"

type Props = {
    type: CanvasNodeType
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    companies: Company[]
    // creationDto é o form validado (sem companyId — recriação sempre usa a empresa do flow) do
    // recurso recém-criado — o histórico de undo/redo do canvas guarda isso pra poder recriar o
    // recurso caso o usuário desfaça essa criação (ver flow-canvas.tsx)
    onCreated: (
        option: DestinationOption,
        creationDto: unknown
    ) => Promise<void>
}

// Cada tipo criável no canvas reaproveita o form dialog + hook já existentes daquele módulo — sem
// recriar formulário nenhum. Sempre dentro da mesma empresa do flow, e o retorno da API permite
// inserir a configuração recém-criada no canvas sem um segundo passo manual. companies vem filtrado pra
// só ela (evita o usuário escolher outra empresa por engano no combobox de criação). Alguns
// módulos (Announcement, Request Template) pedem a empresa como argumento separado do form em vez
// de dentro do form — ver createAnnouncement/createRequestTemplate abaixo.
// IMPORTANTE: montar com `key={type}` no chamador — os hooks chamados aqui variam por `type` num
// switch, o que só é seguro porque o componente é remontado do zero (não re-renderizado com `type`
// mudando) a cada troca de tipo selecionado no painel.
export function CreateNodeDialog({
    type,
    open,
    onOpenChange,
    companyId,
    companies,
    onCreated,
}: Props) {
    switch (type) {
        case "announcement": {
            const { createAnnouncement } = useAnnouncements()
            return (
                <AnnouncementFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    announcement={null}
                    companyId={companyId}
                    onSave={async (form) => {
                        const resourceId = await createAnnouncement(
                            form,
                            companyId,
                            true
                        )
                        if (!resourceId) return false
                        await onCreated(
                            { id: resourceId, label: form.name },
                            form
                        )
                        return true
                    }}
                />
            )
        }
        case "ivr": {
            const { createIvrMenu } = useIvr()
            return (
                <IvrMenuFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    ivrMenu={null}
                    companies={companies}
                    defaultCompanyId={companyId}
                    flowNodeMode
                    onSave={async (form) => {
                        const resourceId = await createIvrMenu(form, companyId)
                        if (!resourceId) return false
                        await onCreated(
                            { id: resourceId, label: form.name },
                            null
                        )
                        return true
                    }}
                />
            )
        }
        case "queue": {
            const { createQueue } = useQueues()
            return (
                <QueueFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    queue={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createQueue(form, true)
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            {
                                id: resourceId,
                                label: `${form.name} (${form.number})`,
                            },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        case "request": {
            const { createRequestTemplate } = useRequestTemplates()
            return (
                <RequestTemplateFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    requestTemplate={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createRequestTemplate(
                            form,
                            companyId,
                            true
                        )
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            { id: resourceId, label: form.name },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        case "timecondition": {
            const { createTimeCondition } = useTimeConditions()
            return (
                <TimeConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    timeCondition={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createTimeCondition(form, true)
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            { id: resourceId, label: form.name },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        case "holiday": {
            const { createHolidayGroup } = useHolidayGroups()
            return (
                <HolidayGroupFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    holidayGroup={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createHolidayGroup(form, true)
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            { id: resourceId, label: form.name },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        case "variable-set": {
            const { createVariableSet } = useVariables()
            return (
                <VariableSetFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableSet={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createVariableSet(form, true)
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            { id: resourceId, label: form.name },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        case "variable-condition": {
            const { createVariableCondition } = useVariableConditions()
            return (
                <VariableConditionFormDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    variableCondition={null}
                    companies={companies}
                    onSave={async (form) => {
                        const resourceId = await createVariableCondition(
                            form,
                            true
                        )
                        if (!resourceId) return false
                        const { companyId: _companyId, ...creationDto } = form
                        await onCreated(
                            { id: resourceId, label: form.name },
                            creationDto
                        )
                        return true
                    }}
                />
            )
        }
        default:
            return null
    }
}
