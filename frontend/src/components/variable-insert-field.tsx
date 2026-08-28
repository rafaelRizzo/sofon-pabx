"use client"

import { useCallback } from "react"
import type {
    FieldValues,
    Path,
    UseFormRegister,
    UseFormSetValue,
    UseFormGetValues,
} from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useVariableInsert } from "@/hooks/use-variable-insert"
import { VariableInsertButton } from "@/components/variable-insert-button"

type Props<T extends FieldValues> = {
    name: Path<T>
    register: UseFormRegister<T>
    setValue: UseFormSetValue<T>
    getValues: UseFormGetValues<T>
    companyId?: string
    placeholder?: string
    multiline?: boolean
    rows?: number
    className?: string
}

// Input/Textarea com um botão de inserir variável de canal Asterisk ou do catálogo customizado da
// empresa (ver variable-insert-button.tsx) acoplado - usar em qualquer campo que aceite placeholder
// {{VAR}} (Request Templates, nó IXCsoft).
export function VariableInsertField<T extends FieldValues>({
    name,
    register,
    setValue,
    getValues,
    companyId,
    placeholder,
    multiline = false,
    rows,
    className,
}: Props<T>) {
    const { elementRef, insert } = useVariableInsert<T>(name, setValue, getValues)
    const { ref, ...rest } = register(name)
    // Ref merge memoizado - inline arrow function recriada a cada render forçava o RHF a
    // desmontar/remontar o registro do campo a cada tecla digitada, travando a revalidação
    // incremental (reValidateMode: "onChange") e deixando o erro do Zod preso na tela.
    const mergedRef = useCallback(
        (el: HTMLInputElement | HTMLTextAreaElement | null) => {
            ref(el)
            elementRef.current = el
        },
        [ref, elementRef]
    )

    return (
        <div className="flex gap-1.5">
            {multiline ? (
                <Textarea
                    placeholder={placeholder}
                    rows={rows}
                    className={className}
                    ref={mergedRef}
                    {...rest}
                />
            ) : (
                <Input
                    placeholder={placeholder}
                    className={className}
                    ref={mergedRef}
                    {...rest}
                />
            )}
            <VariableInsertButton
                onSelect={insert}
                companyId={companyId}
                className={multiline ? "shrink-0 self-start" : "shrink-0 self-center"}
            />
        </div>
    )
}
