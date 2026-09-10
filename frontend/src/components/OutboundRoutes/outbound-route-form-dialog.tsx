"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangleIcon, InfoIcon, PlusIcon, XIcon } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { NumberInput } from "@/components/ui/number-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ExtensionRestrictSelect } from "@/components/OutboundRoutes/extension-restrict-select"
import { TrunkOrderSelect } from "@/components/OutboundRoutes/trunk-order-select"
import { cn } from "@/lib/utils"
import {
    DIAL_PATTERN_PRESETS,
    outboundRouteFormSchema,
    type OutboundRouteForm,
} from "@/hooks/use-outbound-routes"
import { type OutboundRouteFormDialogProps } from "@/components/OutboundRoutes/types"

const PATTERN_COLUMNS = [
    {
        label: "Padrão",
        required: true,
        tooltip:
            "Formato de discagem (sintaxe Asterisk) que o número precisa casar para usar esta rota. Ex: _9XXXXXXXX = 9 dígitos começando com 9 (celular local).",
    },
    {
        label: "Remover prefixo",
        required: false,
        tooltip:
            "Dígitos do início do número discado que devem ser descartados antes de enviar ao tronco. Ex: se o ramal discou 0 + DDD + número, informe 0 para remover esse dígito.",
    },
    {
        label: "Adicionar prefixo",
        required: false,
        tooltip:
            "Dígitos inseridos no início do número (após remover o prefixo) antes de discar pelo tronco. Ex: código da operadora ou o 9 do celular quando o tronco exige.",
    },
] as const

function PatternColumnLabel({
    label,
    tooltip,
    required,
}: {
    label: string
    tooltip: string
    required: boolean
}) {
    return (
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {label}
            {required && <span className="text-destructive">*</span>}
            <Tooltip>
                <TooltipTrigger
                    render={
                        <button
                            type="button"
                            className="inline-flex text-muted-foreground hover:text-foreground"
                        />
                    }
                >
                    <InfoIcon className="size-3" />
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
        </div>
    )
}

const emptyPattern = { pattern: "", prepend: "", prefix: "" }

export function OutboundRouteFormDialog({
    open,
    onOpenChange,
    route,
    trunks,
    extensions,
    existingRoutes,
    onSave,
}: OutboundRouteFormDialogProps) {
    const isEdit = !!route

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<OutboundRouteForm>({
        resolver: zodResolver(outboundRouteFormSchema) as any,
        defaultValues: {
            name: "",
            position: 0,
            trunkIds: [],
            patterns: [emptyPattern],
            extensionIds: [],
        },
    })

    const patternFields = useFieldArray({ control, name: "patterns" })
    const trunkIds = watch("trunkIds")
    const extensionIds = watch("extensionIds") ?? []
    const patterns = watch("patterns")

    // Padrão => nome da rota que já usa ele, entre TODAS as rotas da empresa (exceto a que está
    // sendo editada) - o dialplan é escrito por empresa, não por rota, então precisa ser único aqui
    const otherRoutesPatternMap = useMemo(() => {
        const map = new Map<string, string>()
        for (const r of existingRoutes) {
            if (r.id === route?.id) continue
            for (const p of r.patterns) {
                if (!map.has(p.pattern)) map.set(p.pattern, r.name)
            }
        }
        return map
    }, [existingRoutes, route?.id])

    // Um aviso por linha: duplicado dentro do próprio formulário tem prioridade sobre o de outra rota
    const patternConflicts = useMemo(
        () =>
            patterns.map((p, index) => {
                const value = p.pattern?.trim()
                if (!value) return null
                const duplicatedInForm = patterns.some(
                    (other, i) => i < index && other.pattern?.trim() === value
                )
                if (duplicatedInForm) return "Padrão duplicado neste formulário"
                const routeName = otherRoutesPatternMap.get(value)
                return routeName
                    ? `Padrão já usado na rota "${routeName}"`
                    : null
            }),
        [patterns, otherRoutesPatternMap]
    )
    const hasPatternConflict = patternConflicts.some(Boolean)

    // Usado pelos presets (Celular local, Fixo local...) para desabilitar quem já está em uso -
    // mesma regra de "igual" do patternConflicts, não é checagem de sobreposição de padrão
    function presetConflictReason(pattern: string): string | null {
        if (patterns.some((p) => p.pattern?.trim() === pattern)) {
            return "Já adicionado neste formulário"
        }
        const routeName = otherRoutesPatternMap.get(pattern)
        return routeName ? `Já usado na rota "${routeName}"` : null
    }

    useEffect(() => {
        if (!open) return
        reset({
            name: route?.name ?? "",
            position: route?.position ?? 0,
            trunkIds: route
                ? [...route.trunks]
                      .sort((a, b) => a.position - b.position)
                      .map((t) => t.trunkId)
                : [],
            patterns: route
                ? [...route.patterns]
                      .sort((a, b) => a.position - b.position)
                      .map((p) => ({
                          pattern: p.pattern,
                          prepend: p.prepend ?? "",
                          prefix: p.prefix ?? "",
                      }))
                : [emptyPattern],
            extensionIds: route?.extensions.map((e) => e.extensionId) ?? [],
        })
    }, [open, route, reset])

    const onSubmit = handleSubmit(async (form) => {
        if (hasPatternConflict) {
            toast.error(
                "Corrija os padrões de discagem duplicados antes de salvar"
            )
            return
        }
        const ok = await onSave(form)
        if (ok) onOpenChange(false)
    })

    // Fechar (X, Escape, clique fora, botão Cancelar) com alterações não salvas pede confirmação
    // antes de descartar - só fecha direto quando o form está limpo ou após salvar com sucesso
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
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? "Editar rota de saída"
                                : "Nova rota de saída"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Rota ${route.name}`
                                : "Preencha os dados para criar a rota de saída"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="outbound-route-form"
                        onSubmit={onSubmit}
                        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                    >
                        <ScrollArea className="min-h-0">
                            <FieldGroup className="pr-3">
                                <div className="grid grid-cols-3 gap-3">
                                    <Field className="col-span-2">
                                        <FieldLabel>Nome</FieldLabel>
                                        <Input
                                            placeholder="Ex: celular-sp"
                                            {...register("name")}
                                        />
                                        {errors.name && (
                                            <FieldError>
                                                {errors.name.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>Posição</FieldLabel>
                                        <NumberInput
                                            placeholder="0"
                                            {...register("position")}
                                        />
                                        {errors.position && (
                                            <FieldError>
                                                {errors.position.message}
                                            </FieldError>
                                        )}
                                    </Field>
                                </div>

                                <Field>
                                    <FieldLabel>
                                        Troncos (ordem = prioridade de failover)
                                    </FieldLabel>
                                    <TrunkOrderSelect
                                        trunks={trunks}
                                        value={trunkIds}
                                        onChange={(ids) =>
                                            setValue("trunkIds", ids, {
                                                shouldValidate: true,
                                            })
                                        }
                                    />
                                    {errors.trunkIds && (
                                        <FieldError>
                                            {errors.trunkIds.message as string}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <div className="flex items-center justify-between">
                                        <FieldLabel>
                                            Padrões de discagem
                                        </FieldLabel>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                patternFields.append(
                                                    emptyPattern,
                                                    {
                                                        shouldFocus: false,
                                                    }
                                                )
                                            }
                                        >
                                            <PlusIcon />
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DIAL_PATTERN_PRESETS.map((preset) => {
                                            const conflictReason =
                                                presetConflictReason(
                                                    preset.pattern
                                                )
                                            return (
                                                <Badge
                                                    key={preset.pattern}
                                                    variant="outline"
                                                    title={
                                                        conflictReason ??
                                                        undefined
                                                    }
                                                    className={cn(
                                                        "cursor-pointer hover:bg-accent",
                                                        conflictReason &&
                                                            "cursor-not-allowed opacity-50 hover:bg-transparent"
                                                    )}
                                                    onClick={() => {
                                                        if (conflictReason)
                                                            return
                                                        patternFields.append(
                                                            {
                                                                pattern:
                                                                    preset.pattern,
                                                                prepend: "",
                                                                prefix: "",
                                                            },
                                                            {
                                                                shouldFocus: false,
                                                            }
                                                        )
                                                    }}
                                                >
                                                    <PlusIcon />
                                                    {preset.label}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                    <FieldDescription>
                                        Não achou o padrão do seu caso (ex: um
                                        código especial de 4 ou 5 dígitos)?
                                        Digite o número exato na linha abaixo:
                                        ex: <code>_1404</code> corresponde só a
                                        esse número.
                                    </FieldDescription>
                                    {errors.patterns?.root && (
                                        <FieldError>
                                            {errors.patterns.root.message}
                                        </FieldError>
                                    )}

                                    <TooltipProvider delay={150}>
                                        <div className="space-y-2 rounded-md border p-2">
                                            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                                                {PATTERN_COLUMNS.map((col) => (
                                                    <PatternColumnLabel
                                                        key={col.label}
                                                        {...col}
                                                    />
                                                ))}
                                                <span />
                                            </div>

                                            {patternFields.fields.map(
                                                (field, index) => (
                                                    <div
                                                        key={field.id}
                                                        className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2"
                                                    >
                                                        <div>
                                                            {!errors.patterns?.[
                                                                index
                                                            ]?.pattern &&
                                                                patternConflicts[
                                                                    index
                                                                ] && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="mb-1 w-fit gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-normal text-amber-700 dark:text-amber-400"
                                                                    >
                                                                        <AlertTriangleIcon className="size-3" />
                                                                        {
                                                                            patternConflicts[
                                                                                index
                                                                            ]
                                                                        }
                                                                    </Badge>
                                                                )}
                                                            <Input
                                                                placeholder="_9XXXXXXXX"
                                                                aria-invalid={
                                                                    !!patternConflicts[
                                                                        index
                                                                    ] ||
                                                                    undefined
                                                                }
                                                                {...register(
                                                                    `patterns.${index}.pattern`
                                                                )}
                                                            />
                                                            {errors.patterns?.[
                                                                index
                                                            ]?.pattern && (
                                                                <FieldError>
                                                                    {
                                                                        errors
                                                                            .patterns[
                                                                            index
                                                                        ]
                                                                            ?.pattern
                                                                            ?.message
                                                                    }
                                                                </FieldError>
                                                            )}
                                                        </div>
                                                        <Input
                                                            placeholder="Ex: 0"
                                                            {...register(
                                                                `patterns.${index}.prefix`
                                                            )}
                                                        />
                                                        <Input
                                                            placeholder="Ex: 55"
                                                            {...register(
                                                                `patterns.${index}.prepend`
                                                            )}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            disabled={
                                                                patternFields
                                                                    .fields
                                                                    .length ===
                                                                1
                                                            }
                                                            onClick={() =>
                                                                patternFields.remove(
                                                                    index
                                                                )
                                                            }
                                                        >
                                                            <XIcon />
                                                            <span className="sr-only">
                                                                Remover padrão
                                                            </span>
                                                        </Button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </TooltipProvider>
                                </Field>

                                <Field>
                                    <FieldLabel>
                                        Restringir a ramais específicos
                                        (opcional)
                                    </FieldLabel>
                                    <ExtensionRestrictSelect
                                        extensions={extensions}
                                        value={extensionIds}
                                        onChange={(ids) =>
                                            setValue("extensionIds", ids, {
                                                shouldValidate: true,
                                            })
                                        }
                                    />
                                    <FieldDescription>
                                        Se nenhum ramal for selecionado, a rota
                                        fica disponível para todos os ramais da
                                        empresa.
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
                            form="outbound-route-form"
                            disabled={isSubmitting || hasPatternConflict}
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
