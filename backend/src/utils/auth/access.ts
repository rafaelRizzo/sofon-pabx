import { prisma } from '../../lib/prisma'

export const isAdmin = (role: string) => role === 'admin'

export const getUserCompanyIds = async (userId: string): Promise<string[]> => {
    const rows = await prisma.userCompany.findMany({
        where: { userId },
        select: { companyId: true },
    })
    return rows.map((r) => r.companyId)
}
