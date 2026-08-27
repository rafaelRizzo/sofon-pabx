"use client"

import { useRef } from "react"
import type { FieldValues, Path, UseFormSetValue, UseFormGetValues } from "react-hook-form"

type FieldElement = HTMLInputElement | HTMLTextAreaElement

// Insere um token (ex: "{{CALLERID(num)}}") na posição do cursor de um campo de texto controlado
// por react-hook-form, sem precisar tornar o campo controlled - mantém o `register(name)` normal,
// só precisa mesclar `elementRef` no `ref` do input/textarea (ver VariableInsertButton).
export function useVariableInsert<TFieldValues extends FieldValues>(
    name: Path<TFieldValues>,
    setValue: UseFormSetValue<TFieldValues>,
    getValues: UseFormGetValues<TFieldValues>
) {
    const elementRef = useRef<FieldElement | null>(null)

    function insert(token: string) {
        const el = elementRef.current
        const current = (getValues(name) as unknown as string) ?? ""
        const start = el?.selectionStart ?? current.length
        const end = el?.selectionEnd ?? current.length
        const next = current.slice(0, start) + token + current.slice(end)
        setValue(name, next as any, { shouldDirty: true, shouldValidate: true })
        requestAnimationFrame(() => {
            if (!el) return
            el.focus()
            const pos = start + token.length
            el.setSelectionRange(pos, pos)
        })
    }

    return { elementRef, insert }
}
