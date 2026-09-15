import type { FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../utils/errors/app.error'
import { getUserPermissions } from '../utils/auth/access'
import type { PermissionAction, PermissionResource } from '../utils/auth/permissions'

// admin/reseller bypassam (acesso irrestrito, como já é hoje); a permission list granular
// só restringe role="user"
export const requirePermission = (resource: PermissionResource | 'cdr' | 'call-quality' | 'queue-calls' | 'audit-logs' | 'backup' | 'dids', action: PermissionAction) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
        const { id, role } = req.user!
        if (role !== 'user') return

        const permissions = await getUserPermissions(id)
        if (!permissions.includes(`${resource}:${action}`)) {
            throw new AppError('Forbidden', 403)
        }
    }
}
