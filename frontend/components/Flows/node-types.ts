import type { RouteDestinationType } from "@/components/RouteDestination/route-destination-field"

// IVR fica fora do canvas nesta primeira versão — seus destinos de saída (invalid/timeout/long +
// 1 por dígito configurado) vivem dentro de um array (`options`) substituído por completo no PUT,
// diferente dos outros tipos (campo nomeado direto: destination/trueRoute/onSuccess/etc) — conectar
// via drag exigiria buscar+mesclar esse array, tratamento à parte de uma próxima entrega. Voicemail
// não tem entidade própria (id livre, sem FK) — não faz sentido como nó. Hangup não é um destino
// navegável, é a ausência de um.
export type CanvasNodeType = Exclude<
    RouteDestinationType,
    "hangup" | "voicemail" | "ivr"
>

export const CANVAS_NODE_TYPES: CanvasNodeType[] = [
    "announcement",
    "queue",
    "extension",
    "request",
    "timecondition",
    "holiday",
    "variable-set",
    "variable-condition",
    "flow",
]

// O canvas trabalha com ações de chamada. O tipo do recurso continua sendo armazenado no nó
// para manter compatibilidade com o compilador e com os flows já existentes.
export type CanvasNodeAction =
    | "transfer"
    | "announcement"
    | "timecondition"
    | "holiday"
    | "request"
    | "variable-set"
    | "variable-condition"
    | "flow"

export type NodeActionDefinition = {
    id: CanvasNodeAction
    label: string
    description: string
    resourceTypes: CanvasNodeType[]
}

export const NODE_ACTIONS: NodeActionDefinition[] = [
    {
        id: "transfer",
        label: "Transferir chamada",
        description: "Envia a chamada para uma fila, ramal ou outro flow.",
        resourceTypes: ["queue", "extension", "flow"],
    },
    {
        id: "announcement",
        label: "Tocar anúncio",
        description: "Reproduz um áudio cadastrado.",
        resourceTypes: ["announcement"],
    },
    {
        id: "timecondition",
        label: "Verificar horário",
        description: "Divide o fluxo conforme a condição de horário.",
        resourceTypes: ["timecondition"],
    },
    {
        id: "holiday",
        label: "Verificar feriado",
        description: "Divide o fluxo conforme o grupo de feriados.",
        resourceTypes: ["holiday"],
    },
    {
        id: "request",
        label: "Executar requisição",
        description: "Chama um Request Template configurado.",
        resourceTypes: ["request"],
    },
    {
        id: "variable-set",
        label: "Definir variável",
        description: "Executa um conjunto de variáveis.",
        resourceTypes: ["variable-set"],
    },
    {
        id: "variable-condition",
        label: "Validar variável",
        description: "Avalia uma condição de variável.",
        resourceTypes: ["variable-condition"],
    },
    {
        id: "flow",
        label: "Chamar outro flow",
        description: "Continua a chamada em um flow cadastrado.",
        resourceTypes: ["flow"],
    },
]

export const NODE_ACTION_LABELS: Record<CanvasNodeType, string> = {
    announcement: "Tocar anúncio",
    queue: "Transferir para fila",
    extension: "Transferir para ramal",
    request: "Executar requisição",
    timecondition: "Verificar horário",
    holiday: "Verificar feriado",
    "variable-set": "Definir variável",
    "variable-condition": "Validar variável",
    flow: "Chamar outro flow",
}

type NodeTypeConfig = {
    apiPath: string
    // handles de saída sempre visíveis, mesmo sem nada conectado ainda
    staticSlots: string[]
    // slot -> nome do campo no payload de update desse tipo (backend aceita update parcial,
    // então conectar/desconectar manda só o campo do slot que mudou)
    slotField: Record<string, string>
    // false = só pode ser adicionado ao canvas via "nó existente", não criado direto por aqui
    // (Extension tem form próprio bem mais complexo — sip/pjsip, alocação de alias/senha — fora do
    // escopo de "criar direto no canvas" desta entrega; Flow aninhado fica pra tela de lista, evita
    // aninhamento confuso na primeira versão)
    creatable: boolean
}

export const NODE_TYPE_CONFIG: Record<CanvasNodeType, NodeTypeConfig> = {
    announcement: {
        apiPath: "announcements",
        staticSlots: ["default"],
        slotField: { default: "destination" },
        creatable: true,
    },
    queue: {
        apiPath: "queues",
        staticSlots: ["default"],
        slotField: { default: "postQueueDestination" },
        creatable: true,
    },
    extension: {
        apiPath: "extensions",
        staticSlots: [],
        slotField: {},
        creatable: false,
    },
    request: {
        apiPath: "request-templates",
        staticSlots: ["success", "error"],
        slotField: { success: "onSuccess", error: "onError" },
        creatable: true,
    },
    timecondition: {
        apiPath: "time-conditions",
        staticSlots: ["true", "false"],
        slotField: { true: "trueRoute", false: "falseRoute" },
        creatable: true,
    },
    holiday: {
        apiPath: "holiday-groups",
        staticSlots: ["true", "false"],
        slotField: { true: "trueRoute", false: "falseRoute" },
        creatable: true,
    },
    "variable-set": {
        apiPath: "variables",
        staticSlots: ["default"],
        slotField: { default: "destination" },
        creatable: true,
    },
    "variable-condition": {
        apiPath: "variable-conditions",
        staticSlots: ["true", "false"],
        slotField: { true: "trueRoute", false: "falseRoute" },
        creatable: true,
    },
    flow: {
        apiPath: "flows",
        // Um subflow assume a execução a partir do entry dele; não tem saída própria nesta
        // instância (as próximas conexões pertencem aos nós internos do subflow).
        staticSlots: [],
        slotField: {},
        creatable: false,
    },
}

export const SLOT_LABELS: Record<string, string> = {
    default: "",
    true: "Verdadeiro",
    false: "Falso",
    success: "Sucesso",
    error: "Erro",
    entry: "",
}

// Separação visual dos slots condicionais (true/false, success/error) — cor do texto + do handle,
// pra diferenciar de cara qual saída é qual sem precisar ler o label.
export const SLOT_COLORS: Record<string, { text: string; handle: string }> = {
    true: {
        text: "text-emerald-600 dark:text-emerald-400",
        handle: "bg-emerald-500!",
    },
    success: {
        text: "text-emerald-600 dark:text-emerald-400",
        handle: "bg-emerald-500!",
    },
    false: { text: "text-rose-600 dark:text-rose-400", handle: "bg-rose-500!" },
    error: { text: "text-rose-600 dark:text-rose-400", handle: "bg-rose-500!" },
}

// chave composta type:id — única no canvas independente do tipo, usada como id de nó do React Flow.
// 1 card por recurso: o destino de saída (trueRoute/falseRoute/postQueueDestination/etc) é uma
// coluna do próprio recurso no banco, não existe "conexão por card" — reusar o mesmo destino em
// vários pontos do flow é só ter várias edges convergindo pra esse único card (nativo do React Flow).
export const nodeKey = (type: string, id: string) => `${type}:${id}`
export const parseNodeKey = (key: string): { type: string; id: string } => {
    const idx = key.indexOf(":")
    return { type: key.slice(0, idx), id: key.slice(idx + 1) }
}
