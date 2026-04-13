import { db } from '../../db/config/db'
import { eq, and } from 'drizzle-orm'
import { office_time } from '../../db/schemas/office_time'
import { userCompanies } from '../../db/schemas/user_companies'
import { AppError } from '../../utils/handlers/app.error'

import type {
    CreateOfficeTimeInput,
    UpdateOfficeTimeInput,
} from './schema/office_time.schema'

const officeTimeSelect = {
    id: office_time.id,
    company_id: office_time.company_id,
    name: office_time.name,
    description: office_time.description,
    day_of_week: office_time.day_of_week,
    is_working_day: office_time.is_working_day,
    start_time: office_time.start_time,
    end_time: office_time.end_time,
    lunch_start: office_time.lunch_start,
    lunch_end: office_time.lunch_end,
    obs: office_time.obs,
    status: office_time.status,
    created_at: office_time.created_at,
    updated_at: office_time.updated_at,
}

export const isUserMemberOfCompany = async (userId: string, companyId: string): Promise<boolean> => {
    const [member] = await db
        .select()
        .from(userCompanies)
        .where(
            and(
                eq(userCompanies.user_id, userId),
                eq(userCompanies.company_id, companyId)
            )
        )
        .limit(1)

    return !!member
}

export const getOfficeTimesByCompany = async (companyId: string) => {
    return db
        .select(officeTimeSelect)
        .from(office_time)
        .where(eq(office_time.company_id, companyId))
        .orderBy(office_time.day_of_week)
}

export const getOfficeTimeById = async (id: string) => {
    const [schedule] = await db
        .select(officeTimeSelect)
        .from(office_time)
        .where(eq(office_time.id, id))

    return schedule ?? null
}

export const createOfficeTime = async (data: CreateOfficeTimeInput) => {
    const [existing] = await db
        .select()
        .from(office_time)
        .where(
            and(
                eq(office_time.company_id, data.company_id),
                eq(office_time.day_of_week, data.day_of_week)
            )
        )
        .limit(1)

    if (existing) {
        throw new AppError(
            'Office schedule already exists for this day of week',
            409
        )
    }

    const [created] = await db
        .insert(office_time)
        .values(data)
        .returning(officeTimeSelect)

    return created
}

export const updateOfficeTime = async (
    id: string,
    data: UpdateOfficeTimeInput
) => {
    const [existing] = await db
        .select()
        .from(office_time)
        .where(eq(office_time.id, id))
        .limit(1)

    if (!existing) {
        throw new AppError('Office schedule not found', 404)
    }

    if (data.day_of_week !== undefined) {
        const [duplicate] = await db
            .select()
            .from(office_time)
            .where(
                and(
                    eq(office_time.company_id, existing.company_id),
                    eq(office_time.day_of_week, data.day_of_week)
                )
            )
            .limit(1)

        if (duplicate && duplicate.id !== id) {
            throw new AppError(
                'Office schedule already exists for this day of week',
                409
            )
        }
    }

    const updateData: Partial<UpdateOfficeTimeInput> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.day_of_week !== undefined) updateData.day_of_week = data.day_of_week
    if (data.is_working_day !== undefined) updateData.is_working_day = data.is_working_day

    if (data.start_time !== undefined) updateData.start_time = data.start_time
    if (data.end_time !== undefined) updateData.end_time = data.end_time

    if (data.lunch_start !== undefined) updateData.lunch_start = data.lunch_start
    if (data.lunch_end !== undefined) updateData.lunch_end = data.lunch_end

    if (data.obs !== undefined) updateData.obs = data.obs
    if (data.status !== undefined) updateData.status = data.status

    const [updated] = await db
        .update(office_time)
        .set(updateData)
        .where(eq(office_time.id, id))
        .returning(officeTimeSelect)

    return updated ?? null
}

export const deleteOfficeTime = async (id: string) => {
    const [deleted] = await db
        .delete(office_time)
        .where(eq(office_time.id, id))
        .returning(officeTimeSelect)

    return deleted ?? null
}

interface OfficeTimeStatus {
    is_open: boolean
    reason?: string
    next_status_time?: string
    working_day: boolean
    business_hours: string
    in_lunch_break: boolean
}

export const getOfficeTimeStatus = async (companyId: string) => {
    const now = new Date()

    const brazilNow = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    )

    const currentDayOfWeek = brazilNow.getDay()
    const currentTime = brazilNow.toTimeString().slice(0, 5)

    // 🔥 AQUI MUDA TUDO: busca pelo DIA ATUAL
    const [schedule] = await db
        .select()
        .from(office_time)
        .where(
            and(
                eq(office_time.company_id, companyId),
                eq(office_time.day_of_week, currentDayOfWeek)
            )
        )
        .limit(1)

    if (!schedule) {
        throw new AppError('No schedule found for today', 404)
    }

    if (!schedule.is_working_day) {
        return {
            is_open: false,
            reason: 'Not a working day',
            working_day: false,
            business_hours: 'Closed',
            in_lunch_break: false,
        }
    }

    if (!schedule.start_time || !schedule.end_time) {
        return {
            is_open: false,
            reason: 'Invalid schedule',
            working_day: false,
            business_hours: 'Invalid',
            in_lunch_break: false,
        }
    }

    const start = schedule.start_time.slice(0, 5)
    const end = schedule.end_time.slice(0, 5)

    if (currentTime < start) {
        return {
            is_open: false,
            reason: `Opens at ${start}`,
            next_status_time: start,
            working_day: true,
            business_hours: `${start} - ${end}`,
            in_lunch_break: false,
        }
    }

    if (currentTime > end) {
        return {
            is_open: false,
            reason: `Closed since ${end}`,
            working_day: true,
            business_hours: `${start} - ${end}`,
            in_lunch_break: false,
        }
    }

    if (
        schedule.lunch_start &&
        schedule.lunch_end &&
        currentTime >= schedule.lunch_start.slice(0, 5) &&
        currentTime <= schedule.lunch_end.slice(0, 5)
    ) {
        return {
            is_open: false,
            reason: `In lunch break until ${schedule.lunch_end}`,
            next_status_time: schedule.lunch_end,
            working_day: true,
            business_hours: `${start} - ${end}`,
            in_lunch_break: true,
        }
    }

    return {
        is_open: true,
        working_day: true,
        business_hours: `${start} - ${end}`,
        in_lunch_break: false,
    }
}