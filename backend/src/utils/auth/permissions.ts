// Catálogo de recursos controláveis por permissão granular; só se aplica a role="user"
// (admin/reseller sempre têm acesso irrestrito, ver requirePermission em ../../middleware/permission.middleware).
// Cada recurso gera duas chaves: "<recurso>:view" (ver no menu/listar) e "<recurso>:manage" (criar/editar/excluir).
export const PERMISSION_RESOURCES = [
    'companies',
    'users',
    'extensions',
    'queues',
    'ivr',
    'announcements',
    'callcenter',
    'dids',
    'inbound-routes',
    'outbound-routes',
    'trunks',
    'audios',
    'time-groups',
    'time-conditions',
    'holiday-groups',
    'request-templates',
    'variables',
    'variable-conditions',
] as const

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]
export type PermissionAction = 'view' | 'manage'

// CDR é só leitura, não tem ação "manage"
export const PERMISSION_KEYS = [
    'cdr:view',
    ...PERMISSION_RESOURCES.flatMap((r) => [`${r}:view`, `${r}:manage`] as const),
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]
