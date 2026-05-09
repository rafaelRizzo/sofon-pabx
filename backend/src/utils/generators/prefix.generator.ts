export const generateCompanyPrefix = (): string => {
    const timestamp = Date.now()
    return String(timestamp % 1000000).padStart(6, '0')
}
