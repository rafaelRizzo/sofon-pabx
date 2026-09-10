import { type ReactElement } from "react"
import { type NodeProps } from "@xyflow/react"

import { type Company } from "@/hooks/use-companies"
import { type Flow } from "@/hooks/use-flows"
import {
    type CanvasNodeAction,
    type CanvasNodeType,
} from "@/components/Flows/node-types"
import { type DestinationOption } from "@/components/RouteDestination/route-destination-field"
import { type FlowNameForm } from "@/components/Flows/flow-form-dialog"
import { type FlowNodeData } from "@/components/Flows/flow-node"

export type AddNodePanelProps = {
    onAdd: (action: CanvasNodeAction) => void
}

export type BranchConnectPopoverProps = {
    companyId: string
    defaultType?: CanvasNodeType
    currentOption?: DestinationOption | null
    trigger: ReactElement
    onSelect: (type: CanvasNodeType, option: DestinationOption) => void
    onCreate?: (type: CanvasNodeType) => void
}

export type CreateNodeDialogProps = {
    type: CanvasNodeType
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    companies: Company[]
    // false = auto save desligado - o form NÃO deve chamar a API de criação do recurso; em vez
    // disso registra um recurso "de rascunho" (ver onCreateDraftResource) e segue o mesmo fluxo de
    // onCreated com um id local, só materializado de verdade no backend quando o usuário clicar em
    // "Salvar" no canvas (ver saveDraft em flow-canvas.tsx)
    autoSave: boolean
    // registra o form de criação como rascunho local (sem rede) e devolve um id local (draft-res:<uuid>)
    // pra usar no lugar do id real - só chamado quando autoSave=false
    onCreateDraftResource: (
        type: CanvasNodeType,
        form: unknown,
        label: string,
        companyId: string
    ) => string
    // creationDto é o form validado (sem companyId - recriação sempre usa a empresa do flow) do
    // recurso recém-criado - o histórico de undo/redo do canvas guarda isso pra poder recriar o
    // recurso caso o usuário desfaça essa criação (ver flow-canvas.tsx)
    onCreated: (
        option: DestinationOption,
        creationDto: unknown
    ) => Promise<void>
}

export type EditNodeDialogProps = {
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

export type FlowFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    flow: Flow | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `flow` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companies: Company[]
    onSave: (form: FlowNameForm) => Promise<boolean>
}

export type FlowImportDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    onImported: (flowId: string) => void
}

export type FlowNodeProps = NodeProps & { data: FlowNodeData }

export type FlowsTableProps = {
    flows: Flow[]
    loading: boolean
    companySelected: boolean
    onOpen: (flow: Flow) => void
    onEdit: (flow: Flow) => void
    onDelete: (flow: Flow) => void
    onExport: (flow: Flow) => void
    exporting: boolean
}

export type NodeActionDialogProps = {
    action: CanvasNodeAction | null
    companyId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (type: CanvasNodeType, option: DestinationOption) => void
    onCreate: (type: CanvasNodeType) => void
}
