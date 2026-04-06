import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { companies } from './companies'

type NodeId = string

type Destination = {
    type: 'extension' | 'queue' | 'ivr' | 'announcement' | 'time_condition'
    id: string
}

type WorkflowNode =
    // --- condicionais (true/false) ---
    | { id: NodeId; type: 'blacklist';       on_true: NodeId; on_false: NodeId }
    | { id: NodeId; type: 'holiday';         on_true: NodeId; on_false: NodeId }
    | { id: NodeId; type: 'time_condition';  start: string; end: string; on_true: NodeId; on_false: NodeId }
    | { id: NodeId; type: 'office_hour';     start: string; end: string; on_true: NodeId; on_false: NodeId }

    // --- audio ---
    | { id: NodeId; type: 'play_audio'; audio_id: string; next: NodeId }

    // --- ivr: toca áudio e roteia pelo dígito pressionado ---
    | {
        id: NodeId
        type: 'ivr'
        audio_id: string
        timeout_ms: number
        max_digits: number
        options: Record<string, NodeId>   // '1' → node-x, '2' → node-y
        on_timeout: NodeId                // não digitou nada
        on_invalid: NodeId               // digitou algo fora das options
    }

    // --- coleta de input ---
    | {
        id: NodeId
        type: 'collect_input'
        prompt_audio_id: string
        max_digits: number
        timeout_ms: number
        variable: string                 // nome da variável onde salva o que foi digitado
        next: NodeId
    }

    // --- variáveis ---
    | { id: NodeId; type: 'set_variable';  variable: string; value: string; next: NodeId }
    | { id: NodeId; type: 'check_variable'; variable: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'; value: string; on_true: NodeId; on_false: NodeId }

    // --- http request ---
    | {
        id: NodeId
        type: 'http_request'
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        url: string
        headers?: Record<string, string>
        body?: string                    // suporta interpolação: "Olá {{nome}}"
        response_variable?: string       // salva o response body aqui
        on_success: NodeId
        on_error: NodeId
    }

    // --- terminal ---
    | { id: NodeId; type: 'redirect'; destination: Destination }
    | { id: NodeId; type: 'hangup' }

export type WorkflowDefinition = {
    entry: NodeId
    nodes: Record<NodeId, WorkflowNode>
}

export const workflows = pgTable('workflows', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    company_id: uuid('company_id')
        .notNull()
        .references(() => companies.id),

    name: varchar('name', { length: 255 })
        .notNull(),

    definition: jsonb('definition')
        .$type<WorkflowDefinition>()
        .notNull(),

    created_at: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),

    updated_at: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull()
})