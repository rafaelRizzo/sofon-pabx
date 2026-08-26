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
    'integrations',
    'ixc',
    'variables',
    'variable-conditions',
    'flows',
] as const

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]
export type PermissionAction = 'view' | 'manage'

// CDR, Queue Calls, Audit Logs e Backup são só leitura, não têm ação "manage" — restore (que de
// fato muta estado) é admin-only por role, não por permissão granular (ver backup.routes.ts)
export const PERMISSION_KEYS = [
    'cdr:view',
    'queue-calls:view',
    'audit-logs:view',
    'backup:view',
    ...PERMISSION_RESOURCES.flatMap((r) => [`${r}:view`, `${r}:manage`] as const),
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]
