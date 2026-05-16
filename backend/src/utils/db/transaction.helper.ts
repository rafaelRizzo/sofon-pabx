interface CacheInvalidation {
    namespace: string
    pattern?: string
}

export class TransactionHelper {
    static async execute<T>(
        callback: () => Promise<T>,
        cacheInvalidations: CacheInvalidation[]
    ): Promise<T> {
        const { cacheManager } = await import('../cache/cache.manager')

        try {
            const result = await callback()

            for (const inv of cacheInvalidations) {
                if (inv.pattern) {
                    await cacheManager.invalidate(inv.namespace, inv.pattern)
                } else {
                    await cacheManager.invalidate(inv.namespace)
                }
            }

            return result
        } catch (error) {
            throw error
        }
    }
}
