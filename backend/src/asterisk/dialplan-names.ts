// Nomes de contexto/exten compartilhados entre os repositórios que resolvem RouteDestination
// (timecondition, inboundroute, ivr) — extraído num módulo sem dependências pra evitar import
// circular entre esses repositórios (cada um precisa resolver destino apontando pros outros).
export const TC_CONTEXT = 'timeconditions'
export const tcEntry = (tcId: string) => `tc-${tcId}`

export const HOL_CONTEXT = 'holidays'
export const holEntry = (id: string) => `hol-${id}`

export const ANNOUNCEMENT_CONTEXT = 'announcements'
export const announcementExten = (id: string) => `ann-${id}`

export const IVR_CONTEXT = 'ivrs'
export const ivrExten = (id: string) => `ivr-${id}`

export const REQUEST_TEMPLATE_CONTEXT = 'request-templates'
export const requestTemplateExten = (id: string) => `req-${id}`

export const SURVEY_CONTEXT = 'callcenter-surveys'
export const surveyExten = (queueId: string) => `survey-${queueId}`

export const VAR_CONTEXT = 'variables'
export const varEntry = (id: string) => `var-${id}`

export const VARCOND_CONTEXT = 'variable-conditions'
export const varCondEntry = (id: string) => `varcond-${id}`

export const FLOW_CONTEXT = 'flows'
export const flowExten = (id: string) => `flow-${id}`

// Contexto materializado por instância de nó. Recursos continuam nos seus contextos próprios;
// este contexto só inicia um nó e recebe seus ports de saída, preservando a reutilização do
// recurso Asterisk entre vários workflows.
export const FLOW_NODE_CONTEXT = 'flow-nodes'
export const flowNodeExten = (id: string) => `node-${id}`
export const flowNodeExitExten = (id: string, port: string) => `exit-${id}-${port.replace(/[^a-zA-Z0-9_-]/g, '_')}`

// setado no entry point de from-trunk-routed (inboundroute.repository.ts), lido pelo AGI
// queue-route (agi-server.ts) pra casar RoutingRule.conditions.trunkId — variável de canal
// sobrevive a qualquer Goto intermediário (timecondition/holiday/ivr) até chegar na fila
export const ROUTING_TRUNK_VAR = 'ROUTING_TRUNK_ID'
