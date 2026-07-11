import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function NumberInput({
    className,
    ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
    return (
        <Input
            type="number"
            className={cn(
                "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                className
            )}
            {...props}
        />
    )
}

export { NumberInput }
