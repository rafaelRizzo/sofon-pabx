"use client"

import { useState } from "react"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ConfirmDeleteDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    /** Nome do item exibido em negrito na descrição */
    itemName?: string
    /** Deve retornar true no sucesso (fecha o dialog) */
    onConfirm: () => Promise<boolean>
}

export function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title,
    itemName,
    onConfirm,
}: ConfirmDeleteDialogProps) {
    const [removing, setRemoving] = useState(false)

    const handleConfirm = async () => {
        setRemoving(true)
        const ok = await onConfirm()
        setRemoving(false)
        if (ok) onOpenChange(false)
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !removing) onOpenChange(false)
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tem certeza que deseja deletar{" "}
                        {itemName ? <strong>{itemName}</strong> : "este item"}?
                        Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={removing}>
                        Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={removing}
                        onClick={handleConfirm}
                    >
                        {removing ? "Deletando..." : "Deletar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
