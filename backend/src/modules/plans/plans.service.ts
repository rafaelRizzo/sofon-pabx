import { db } from '../../db/config/db'
import { eq } from 'drizzle-orm'
import { plans } from '../../db/schemas/plans'
import { AppError } from '../../utils/handlers/app.error'
import { PlansCache } from './cache/plans.cache'

import type {
    CreatePlanInput,
    UpdatePlanInput,
} from './schemas/plans.schema'

const planSelect = {
    id: plans.id,
    name: plans.name,
    description: plans.description,
    price: plans.price,
    features: plans.features,
    status: plans.status,
    created_at: plans.created_at,
    updated_at: plans.updated_at,
}

export const getAllPlans = async () => {
    const cached = await PlansCache.getAllPlans()
    if (cached) return cached

    const result = await db.select(planSelect).from(plans)
    await PlansCache.setAllPlans(result)

    return result
}

export const getPlanById = async (id: bigint) => {
    const cached = await PlansCache.getPlan(id.toString())
    if (cached) return cached

    const [plan] = await db
        .select(planSelect)
        .from(plans)
        .where(eq(plans.id, id))

    if (plan) {
        await PlansCache.setPlan(id.toString(), plan)
    }

    return plan ?? null
}

export const createPlan = async (data: CreatePlanInput) => {
    const [existingPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.name, data.name))

    if (existingPlan) {
        throw new AppError('Plan already exists', 409)
    }

    const [plan] = await db
        .insert(plans)
        .values({
            name: data.name,
            description: data.description,
            price: data.price.toString(),
            features: data.features ?? {},
        })
        .returning(planSelect)

    await PlansCache.invalidateAllPlans()

    return plan
}

export const updatePlan = async (id: bigint, data: UpdatePlanInput) => {
    const [existingPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, id))

    if (!existingPlan) {
        throw new AppError('Plan not found', 404)
    }

    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.price !== undefined) updateData.price = data.price.toString()
    if (data.features !== undefined) updateData.features = data.features

    const [plan] = await db
        .update(plans)
        .set(updateData)
        .where(eq(plans.id, id))
        .returning(planSelect)

    await PlansCache.invalidatePlan(id.toString())
    await PlansCache.invalidateAllPlans()

    return plan ?? null
}

export const deletePlan = async (id: bigint) => {
    const [plan] = await db
        .delete(plans)
        .where(eq(plans.id, id))
        .returning(planSelect)

    await PlansCache.invalidatePlan(id.toString())
    await PlansCache.invalidateAllPlans()

    return plan ?? null
}
