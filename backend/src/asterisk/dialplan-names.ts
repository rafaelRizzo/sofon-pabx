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
