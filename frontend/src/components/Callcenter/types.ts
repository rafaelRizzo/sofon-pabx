import { type RoutingRule, type RoutingRuleForm } from "@/hooks/use-routing-rules"
import { type PauseReason, type PauseReasonForm } from "@/hooks/use-pause-reasons"
import { type Trunk } from "@/hooks/use-trunks"

export type AgentScopesPanelProps = {
    companyId: string
}

export type PauseReasonsPanelProps = {
    companyId: string
}

export type PauseReasonFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    pauseReason: PauseReason | null
    companyId: string
    onSave: (form: PauseReasonForm) => Promise<boolean>
}

export type PauseReasonsTableProps = {
    pauseReasons: PauseReason[]
    loading: boolean
    onEdit: (pauseReason: PauseReason) => void
    onDelete: (pauseReason: PauseReason) => void
}

export type CallRatingsPanelProps = {
    companyId: string
}

export type RoutingRuleFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    routingRule: RoutingRule | null
    companyId: string
    trunks: Trunk[]
    onSave: (form: RoutingRuleForm) => Promise<boolean>
}

export type RoutingRulesPanelProps = {
    companyId: string
}

export type RoutingRulesTableProps = {
    routingRules: RoutingRule[]
    trunks: Trunk[]
    loading: boolean
    onEdit: (routingRule: RoutingRule) => void
    onDelete: (routingRule: RoutingRule) => void
}
