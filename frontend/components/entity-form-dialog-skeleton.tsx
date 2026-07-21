"use client"

import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
    fieldCount?: number
}

// Conteúdo de loading de um *-form-dialog em modo edição, enquanto o registro ainda está sendo
// buscado por id (ver EditNodeDialog em components/Flows/edit-node-dialog.tsx). Sem isso, o dialog
// renderiza com a entidade ainda null e é indistinguível do modo de criação (título "Novo X",
// campos vazios) até o fetch resolver.
// Renderiza só o conteúdo (sem <Dialog>/<DialogContent> própria) para ser usado dentro do
// DialogContent já montado pelo form real — troca o <Dialog> raiz entre loading/carregado faz o
// React desmontar e remontar o Popup, o que repete a animação de abertura (lê como "piscar").
export function EntityFormDialogSkeletonContent({ fieldCount = 3 }: Props) {
    return (
        <>
            <DialogHeader>
                <DialogTitle render={<Skeleton className="h-5 w-40" />} />
                <DialogDescription render={<Skeleton className="h-4 w-56" />} />
            </DialogHeader>

            <div className="flex flex-col gap-4">
                {Array.from({ length: fieldCount }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                ))}
            </div>

            <DialogFooter>
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
            </DialogFooter>
        </>
    )
}
