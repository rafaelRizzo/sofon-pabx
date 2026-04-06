import { AppError } from './app.error'

export const requireAdmin = (role: string) => {
    if (role !== 'admin') {
        throw new AppError('You do not have permission to perform this action', 403)
    }
}

export const requireSelfOrAdmin = (role: string, requestedId: string, loggedUserId: string) => {
    if (role !== 'admin' && requestedId !== loggedUserId) {
        throw new AppError('You cannot perform this action on another user', 403)
    }
}