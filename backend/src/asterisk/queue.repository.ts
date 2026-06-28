import { prisma } from '../lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type AsteriskQueueData = {
    strategy?: string
    musicOnHold?: string
    timeout?: number
    retry?: number
    maxLen?: number
    wrapupTime?: number
    announce?: string | null
    announceFrequency?: number
    joinEmpty?: boolean
    leaveWhenEmpty?: boolean
    weight?: number
}

export const AsteriskQueueRepository = {
    async createQueue(tx: Tx, asteriskName: string, data: AsteriskQueueData) {
        await tx.queues.create({
            data: {
                name: asteriskName,
                strategy: data.strategy,
                musiconhold: data.musicOnHold,
                timeout: data.timeout,
                retry: data.retry,
                maxlen: data.maxLen,
                wrapuptime: data.wrapupTime,
                announce: data.announce ?? null,
                announceFreq: data.announceFrequency,
                joinempty: data.joinEmpty ? 'yes' : 'no',
                leavewhenempty: data.leaveWhenEmpty ? 'yes' : 'no',
                weight: data.weight,
            },
        })
    },

    async updateQueue(tx: Tx, asteriskName: string, update: Record<string, any>) {
        if (Object.keys(update).length > 0)
            await tx.queues.update({ where: { name: asteriskName }, data: update })
    },

    async renameQueue(tx: Tx, oldName: string, newName: string) {
        await tx.queue_members.updateMany({
            where: { queue_name: oldName },
            data: { queue_name: newName },
        })
        await tx.queues.update({ where: { name: oldName }, data: { name: newName } })
    },

    async deleteQueue(tx: Tx, asteriskName: string) {
        await tx.queue_members.deleteMany({ where: { queue_name: asteriskName } })
        await tx.queues.deleteMany({ where: { name: asteriskName } })
    },

    async deleteManyQueues(tx: Tx, asteriskNames: string[]) {
        if (asteriskNames.length > 0) {
            await tx.queue_members.deleteMany({ where: { queue_name: { in: asteriskNames } } })
            await tx.queues.deleteMany({ where: { name: { in: asteriskNames } } })
        }
    },

    async addMember(tx: Tx, asteriskQueueName: string, iface: string, opts: { memberName: string, penalty: number, paused: boolean }) {
        await tx.queue_members.create({
            data: {
                queue_name: asteriskQueueName,
                interface: iface,
                membername: opts.memberName,
                state_interface: iface,
                penalty: opts.penalty,
                paused: opts.paused ? 1 : 0,
            },
        })
    },

    async updateMember(tx: Tx, asteriskQueueName: string, iface: string, data: { penalty?: number, paused?: boolean }) {
        const update: Record<string, any> = {}
        if (data.penalty !== undefined) update.penalty = data.penalty
        if (data.paused !== undefined) update.paused = data.paused ? 1 : 0
        if (Object.keys(update).length > 0)
            await tx.queue_members.update({
                where: { queue_name_interface: { queue_name: asteriskQueueName, interface: iface } },
                data: update,
            })
    },

    async removeMember(tx: Tx, asteriskQueueName: string, iface: string) {
        await tx.queue_members.deleteMany({ where: { queue_name: asteriskQueueName, interface: iface } })
    },

    async removeMembersByInterfaces(tx: Tx, interfaces: string[]) {
        if (interfaces.length > 0)
            await tx.queue_members.deleteMany({ where: { interface: { in: interfaces } } })
    },

    async updateMemberInterfaces(tx: Tx, oldIface: string, newIface: string) {
        await tx.queue_members.updateMany({
            where: { interface: oldIface },
            data: { interface: newIface, state_interface: newIface },
        })
    },
}
