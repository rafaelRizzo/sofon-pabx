// Catálogo de recursos controláveis por permissão granular; só se aplica a role="user"
// (admin sempre tem acesso irrestrito, ver requirePermission em ../../middleware/permission.middleware).
// Cada recurso gera duas chaves: "<recurso>:view" (ver no menu/listar) e "<recurso>:manage" (criar/editar/excluir).
export const PERMISSION_RESOURCES = [
    'companies',
    'users',
    'extensions',
    'queues',
    'ivr',
    'announcements',
    'callcenter',
    'inbound-routes',
    'outbound-routes',
    'trunks',
    'audios',
    'time-groups',
    'time-conditions',
    'holiday-groups',
    'request-templates',
    'integrations',
    'ixc',
    'formatter',
    'variables',
    'variable-conditions',
    'variable-catalog',
    'flows',
] as const

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]
export type PermissionAction = 'view' | 'manage'

// CDR, Call Quality, Queue Calls, Audit Logs, Backup e DIDs são só leitura aqui, não têm ação
// "manage" concedível: restore (Backup) é admin-only por role, não por permissão granular (ver
// backup.routes.ts); criar/editar/excluir DID é admin-only por role (ver dids.routes.ts) - só um
// admin pode disponibilizar/vincular número a uma empresa, nunca um role="user", mesmo que alguém
// tentasse conceder essa permissão manualmente - "dids:manage" simplesmente não existe pra conceder
export const PERMISSION_KEYS = [
    'cdr:view',
    'call-quality:view',
    'queue-calls:view',
    'audit-logs:view',
    'backup:view',
    'dids:view',
    ...PERMISSION_RESOURCES.flatMap((r) => [`${r}:view`, `${r}:manage`] as const),
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]
