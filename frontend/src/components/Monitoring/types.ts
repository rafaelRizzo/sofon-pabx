import { type ExtensionSortBy } from "@/components/Monitoring/extension-sort-toggle"
import type {
    RealtimeExtension,
    RealtimeQueue,
    RealtimeQueueMember,
    RealtimeTrunk,
} from "@/hooks/use-realtime"

export type ExtensionSortToggleProps = {
    value: ExtensionSortBy
    onValueChange: (value: ExtensionSortBy) => void
}

export type HideOfflineSwitchProps = {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export type QueueMembersPopoverProps = {
    members: RealtimeQueueMember[]
    // ligação ativa mostrada por membro vem do estado do ramal (rt:ext:calls:*), não é escopada
    // à fila - mas como um ramal só atende uma chamada por vez na prática, já resolve "quem esse
    // membro está atendendo agora"
    extensions: RealtimeExtension[]
}

export type RealtimeExtensionCardsProps = {
    extensions: RealtimeExtension[]
    queues: RealtimeQueue[]
    loading: boolean
    companySelected: boolean
    // sobrescreve a mensagem de "nenhum ramal" - usado quando o hideOffline filtrou tudo (front,
    // ver monitoring/page.tsx), pra não parecer que a empresa não tem ramal nenhum cadastrado
    emptyMessage?: string
}

export type RealtimeQueuesPanelProps = {
    queues: RealtimeQueue[]
    extensions: RealtimeExtension[]
    loading: boolean
    companySelected: boolean
}

export type RealtimeStatsProps = {
    extensions: RealtimeExtension[]
    queues: RealtimeQueue[]
    loading: boolean
}

export type RealtimeTrunkCardsProps = {
    trunks: RealtimeTrunk[]
    loading: boolean
    companySelected: boolean
}
