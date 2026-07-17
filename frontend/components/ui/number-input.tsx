import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// input[type=number] nativo aceita "e"/"E" (notação científica, ex: "1e5" vira 100000 sem
// nenhum feedback visual) e "+" digitados, bloqueados na tecla e no paste independente de min/max
const BLOCKED_CHARS = /[eE+]/

function NumberInput({
    className,
    onKeyDown,
    onPaste,
    onChange,
    min,
    max,
    ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
    // "-" só é permitido quando o próprio campo aceita negativo (min < 0). Nenhum uso atual
    // do NumberInput no projeto passa min negativo, mas não há motivo pra travar quem passar
    const allowMinus = min !== undefined && Number(min) < 0

    return (
        <Input
            type="number"
            min={min}
            max={max}
            onKeyDown={(e) => {
                // e.key.length > 1 == tecla especial (Backspace, Delete, Enter, ArrowLeft...).
                // Nunca bloquear essas: "Backspace"/"Delete"/"Enter"/"Escape" contêm a letra "e"
                // e batiam no regex, travando o apagar
                if (e.key.length === 1 && (BLOCKED_CHARS.test(e.key) || (e.key === "-" && !allowMinus))) {
                    e.preventDefault()
                }
                onKeyDown?.(e)
            }}
            onPaste={(e) => {
                const text = e.clipboardData.getData("text")
                if (BLOCKED_CHARS.test(text) || (text.includes("-") && !allowMinus)) {
                    e.preventDefault()
                }
                onPaste?.(e)
            }}
            onChange={(e) => {
                // max/min do input[type=number] só marcam :invalid, não impedem digitar além do
                // limite (dá pra digitar 999999999999999 mesmo com max=20) — clampa aqui pra o
                // valor nunca ficar fora do intervalo que o backend aceita, sem depender do
                // usuário perceber o erro só no submit
                if (e.target.value !== "") {
                    if (max !== undefined && Number(e.target.value) > Number(max)) e.target.value = String(max)
                    if (min !== undefined && Number(e.target.value) < Number(min)) e.target.value = String(min)
                }
                onChange?.(e)
            }}
            className={cn(
                "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                className
            )}
            {...props}
        />
    )
}

export { NumberInput }
