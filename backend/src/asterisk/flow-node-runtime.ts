import { FLOW_NODE_CONTEXT, flowNodeExitExten } from './dialplan-names'
import type { DialplanRow } from './dialplan-file.repository'

export const FLOW_NODE_ID_VAR = 'FLOW_NODE_ID'

// A saída dinâmica é usada pelos contextos de recursos legados. Um Queue/Announcement reutilizado
// continua com sua rota antiga quando chamado diretamente, mas quando foi iniciado por um FlowNode
// ele salta para a porta daquela instância do canvas.
export function nodeExitCheck(context: string, exten: string, priority: number, port: string): DialplanRow {
    return {
        context,
        exten,
        priority,
        app: 'GotoIf',
        appdata: `$["\${${FLOW_NODE_ID_VAR}}" != ""]?${FLOW_NODE_CONTEXT},exit-\${${FLOW_NODE_ID_VAR}}-${port.replace(/[^a-zA-Z0-9_-]/g, '_')},1`,
    }
}

export const nodeExitTarget = (nodeId: string, port: string) =>
    `${FLOW_NODE_CONTEXT},${flowNodeExitExten(nodeId, port)},1`
