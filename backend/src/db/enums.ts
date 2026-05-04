export const USER_ROLES = ['admin', 'user'] as const
export const USER_STATUSES = ['active', 'inactive', 'blocked'] as const
export const PLAN_STATUSES = ['active', 'inactive'] as const
export const COMPANY_STATUSES = ['active', 'inactive', 'blocked', 'guest'] as const
export const EXTENSION_STATUSES = ['active', 'inactive'] as const
export const EXTENSION_DTMFMODES = ['rfc2833', 'info', 'inband'] as const
export const EXTENSION_NAT_MODES = ['yes', 'no', 'force_rport', 'comedia'] as const

export type UserRole = typeof USER_ROLES[number]
export type UserStatus = typeof USER_STATUSES[number]
export type PlanStatus = typeof PLAN_STATUSES[number]
export type CompanyStatus = typeof COMPANY_STATUSES[number]
export type ExtensionStatus = typeof EXTENSION_STATUSES[number]
export type ExtensionDtmfMode = typeof EXTENSION_DTMFMODES[number]
export type ExtensionNatMode = typeof EXTENSION_NAT_MODES[number]
