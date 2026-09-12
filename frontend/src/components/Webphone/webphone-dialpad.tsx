"use client"

import { Button } from "@/components/ui/button"

const KEYS: Array<{ digit: string; letters?: string }> = [
    { digit: "1" },
    { digit: "2", letters: "ABC" },
    { digit: "3", letters: "DEF" },
    { digit: "4", letters: "GHI" },
    { digit: "5", letters: "JKL" },
    { digit: "6", letters: "MNO" },
    { digit: "7", letters: "PQRS" },
    { digit: "8", letters: "TUV" },
    { digit: "9", letters: "WXYZ" },
    { digit: "*" },
    { digit: "0", letters: "+" },
    { digit: "#" },
]

type WebphoneDialpadProps = {
    onDigit: (digit: string) => void
    disabled?: boolean
}

// Grid burro de discagem, sem lógica de SIP - reutilizado tanto pra montar o número (idle)
// quanto pra mandar DTMF (in-call), quem decide o que fazer com o dígito é o onDigit do chamador.
export function WebphoneDialpad({ onDigit, disabled }: WebphoneDialpadProps) {
    return (
        <div className="grid grid-cols-3 gap-1.5">
            {KEYS.map(({ digit, letters }) => (
                <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => onDigit(digit)}
                    className="flex h-11 flex-col gap-0 leading-none"
                >
                    <span className="text-base font-medium">{digit}</span>
                    {letters && (
                        <span className="text-[9px] tracking-wide text-muted-foreground">
                            {letters}
                        </span>
                    )}
                </Button>
            ))}
        </div>
    )
}
