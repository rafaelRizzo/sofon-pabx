import { type RoutingRule, type RoutingRuleForm } from "@/hooks/use-routing-rules"
import { type Trunk } from "@/hooks/use-trunks"

export type AgentScopesPanelProps = {
    companyId: string
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
