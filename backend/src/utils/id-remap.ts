import type { RouteDestination } from '../schemas/route-destination.schema'
import { AppError } from './errors/app.error'

// Chave `${entityType}:${oldId}` -> novo id criado durante o restore. entityType usa os mesmos
// nomes de ROUTE_DEST_TYPES/FlowNodeType (ver DEST_TYPE_TO_ENTITY) exceto "extension"/"trunk"/
// "did"/"audio"/"integrationCredential"/"agentCompanyScope" que não são destino de rota mas
// também precisam de remap (FKs diretas).
export type IdMap = Map<string, string>

export function mapId(idMap: IdMap, entityType: string, oldId: string): string {
    const newId = idMap.get(`${entityType}:${oldId}`)
    if (!newId)
        throw new AppError(
            `Backup restore: referência quebrada - ${entityType}:${oldId} não foi criado (arquivo de backup corrompido ou incompleto)`,
            400
        )
    return newId
}

export function mapIdOptional(idMap: IdMap, entityType: string, oldId: string | null | undefined): string | null {
    if (!oldId) return null
    return mapId(idMap, entityType, oldId)
}

// type de RouteDestination/FlowNode -> namespace usado no IdMap. voicemail/hangup ficam de fora
// de propósito: voicemail.id é livre (sem FK, ver route-destination.schema.ts), hangup não tem id.
export const DEST_TYPE_TO_ENTITY: Record<string, string> = {
    extension: 'extension',
    queue: 'queue',
    timecondition: 'timeCondition',
    holiday: 'holidayGroup',
    announcement: 'announcement',
    ivr: 'ivrMenu',
    request: 'requestTemplate',
    ixc: 'ixcNode',
    'variable-set': 'variableSet',
    'variable-condition': 'variableCondition',
    flow: 'flow'
}

// Usado nos campos destination/trueRoute/falseRoute/postQueueDestination/onSuccess/onError/
// entryDestination - todos com o mesmo shape {type, id}. hangup/null vira null (create já
// assume hangup quando o campo é omitido).
export function remapDestination(
    idMap: IdMap,
    dest: RouteDestination | null | undefined
): RouteDestination | null {
    if (!dest || dest.type === 'hangup') return null
    if (dest.type === 'voicemail') return dest
    const entityType = DEST_TYPE_TO_ENTITY[dest.type]
    if (!entityType) return dest
    return { type: dest.type, id: mapId(idMap, entityType, dest.id) } as RouteDestination
}

// Usado só em FlowNode.resourceId - mesma família de tipos de RouteDestination, mas nunca é
// {type,id}, é só o id cru (o type já vem de FlowNode.type).
export function remapResourceId(idMap: IdMap, type: string, resourceId: string | null | undefined): string | null {
    if (!resourceId) return null
    if (type === 'voicemail') return resourceId
    const entityType = DEST_TYPE_TO_ENTITY[type]
    if (!entityType) return resourceId
    return mapId(idMap, entityType, resourceId)
}

// true quando dest carrega um destino "de verdade" (não hangup/vazio) - usado pra decidir se
// vale a pena adiar uma chamada de update() na fase 2 (cada update() dispara regenerate de
// dialplan; pular quando não há nada a religar evita reload desnecessário)
export function hasDestination(dest: RouteDestination | null | undefined): boolean {
    return !!dest && dest.type !== 'hangup'
}
