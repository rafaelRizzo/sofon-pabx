import { z } from 'zod'

// Nome de variável de canal DECLARADA (produzida por IvrMenu.variableName/VariableSet.assignments)
// - mais restrito que SAFE_VARIABLE_REF_REGEX (dialplan-safety.ts), que também aceita builtins do
// Asterisk (CALLERID/DB) usados só do lado consumidor (VariableCondition.rules).
export const VARIABLE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/

export const variableNameSchema = z.string().min(1).max(80)
    .regex(VARIABLE_NAME_REGEX, 'Only letters, digits and underscore, starting with a letter or underscore')
