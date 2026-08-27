"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RouteDestinationField } from "@/components/RouteDestination/route-destination-field"
import { type Did } from "@/hooks/use-dids"
import {
    createInboundRouteFormSchema,
    type InboundRoute,
    type InboundRouteForm,
} from "@/hooks/use-inbound-routes"
import { type Trunk } from "@/hooks/use-trunks"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    route: InboundRoute | null
    companyId: string
    dids: Did[]
    trunks: Trunk[]
    // Todas as rotas da empresa - usadas só pra avisar em tempo real sobre combinação
    // DID + tronco duplicada; a validação que vale é o 409 do backend
    existingRoutes: InboundRoute[]
    onSave: (form: InboundRouteForm) => Promise<boolean>
}

export function InboundRouteFormDialog({
    open,
    onOpenChange,
    route,
    companyId,
    dids,
    trunks,
    existingRoutes,
    onSave,
}: Props) {
    const isEdit = !!route

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<InboundRouteForm>({
        resolver: zodResolver(createInboundRouteFormSchema) as any,
        defaultValues: {
            name: "",
            didId: "",
            trunkId: "",
            destination: { type: "hangup" },
        },
    })

    const didId = watch("didId")
    const trunkId = watch("trunkId")
    const destination = watch("destination")

    useEffect(() => {
        if (!open) return
        reset({
            name: route?.name ?? "",
            didId: route?.didId ?? "",
            trunkId: route?.trunkId ?? "",
            destination: route?.destination ?? { type: "hangup" },
        })
    }, [open, route, reset])

    // Mesma checagem do backend (trunkId + didId único) - só se aplica à criação, já que
    // o PUT não permite trocar DID/tronco de uma rota existente
    const duplicateRouteName = useMemo(() => {
        if (isEdit || !didId || !trunkId) return null
        const dup = existingRoutes.find(
            (r) => r.didId === didId && r.trunkId === trunkId
        )
        return dup?.name ?? null
    }, [isEdit, didId, trunkId, existingRoutes])

    const selectedDid = dids.find((d) => d.id === didId) ?? null
    const selectedTrunk = trunks.find((t) => t.id === trunkId) ?? null

    const onSubmit = handleSubmit(async (form) => {
        if (duplicateRouteName) {
            toast.error(
                `Já existe uma rota para esse DID + tronco: "${duplicateRouteName}"`
            )
            return
        }
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    // Fechar (X, Escape, clique fora, botão Cancelar) com alterações não salvas pede confirmação
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
    function requestClose(nextOpen: boolean) {
        if (!nextOpen && isDirty) {
            setConfirmDiscardOpen(true)
            return
        }
        onOpenChange(nextOpen)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={requestClose}>
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? "Editar rota de entrada"
                                : "Nova rota de entrada"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Rota ${route.name}`
                                : "Preencha os dados para criar a rota de entrada"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="inbound-route-form"
                        onSubmit={onSubmit}
                        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                    >
                        <ScrollArea className="min-h-0">
                            <FieldGroup className="pr-3">
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: 0800-suporte"
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <FieldError>
                                            {errors.name.message}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>DID</FieldLabel>
                                    {isEdit ? (
                                        <Input
                                            disabled
                                            value={route.did.number}
                                        />
                                    ) : (
                                        <Combobox<Did>
                                            items={dids}
                                            value={selectedDid}
                                            itemToStringLabel={(d) => d.number}
                                            isItemEqualToValue={(a, b) =>
                                                a.id === b.id
                                            }
                                            onValueChange={(d) =>
                                                setValue("didId", d?.id ?? "", {
                                                    shouldValidate: true,
                                                })
                                            }
                                        >
                                            <ComboboxInput placeholder="Buscar DID..." />
                                            <ComboboxContent>
                                                <ComboboxEmpty>
                                                    Nenhum DID encontrado
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(d: Did) => (
                                                        <ComboboxItem
                                                            key={d.id}
                                                            value={d}
                                                        >
                                                            {d.number}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    )}
                                    {errors.didId && (
                                        <FieldError>
                                            {errors.didId.message}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Tronco</FieldLabel>
                                    {isEdit ? (
                                        <Input
                                            disabled
                                            value={route.trunk.name}
                                        />
                                    ) : (
                                        <Combobox<Trunk>
                                            items={trunks}
                                            value={selectedTrunk}
                                            itemToStringLabel={(t) => t.name}
                                            isItemEqualToValue={(a, b) =>
                                                a.id === b.id
                                            }
                                            onValueChange={(t) =>
                                                setValue(
                                                    "trunkId",
                                                    t?.id ?? "",
                                                    { shouldValidate: true }
                                                )
                                            }
                                        >
                                            <ComboboxInput placeholder="Buscar tronco..." />
                                            <ComboboxContent>
                                                <ComboboxEmpty>
                                                    Nenhum tronco encontrado
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(t: Trunk) => (
                                                        <ComboboxItem
                                                            key={t.id}
                                                            value={t}
                                                        >
                                                            {t.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    )}
                                    {errors.trunkId && (
                                        <FieldError>
                                            {errors.trunkId.message}
                                        </FieldError>
                                    )}
                                    {duplicateRouteName && (
                                        <FieldError>
                                            Já existe uma rota para esse DID +
                                            tronco: &quot;
                                            {duplicateRouteName}&quot;
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel>Destino</FieldLabel>
                                    <RouteDestinationField
                                        value={destination}
                                        onChange={(d) =>
                                            setValue("destination", d, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                        companyId={companyId}
                                    />
                                    <FieldDescription>
                                        Para onde a chamada é direcionada ao
                                        chegar nesse DID pelo tronco
                                        selecionado.
                                    </FieldDescription>
                                </Field>
                            </FieldGroup>
                        </ScrollArea>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => requestClose(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form="inbound-route-form"
                            disabled={isSubmitting || !!duplicateRouteName}
                        >
                            {isSubmitting
                                ? isEdit
                                    ? "Salvando..."
                                    : "Criando..."
                                : isEdit
                                  ? "Salvar"
                                  : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={confirmDiscardOpen}
                onOpenChange={setConfirmDiscardOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Descartar alterações?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit
                                ? ` na rota "${route.name}"`
                                : " nesta rota"}
                            . Se sair agora, elas serão perdidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Continuar editando
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                setConfirmDiscardOpen(false)
                                onOpenChange(false)
                            }}
                        >
                            Descartar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
