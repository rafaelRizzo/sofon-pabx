"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { CodecCheckboxes } from "@/components/codec-checkboxes"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { type Company } from "@/hooks/use-companies"
import {
    createTrunkSchema,
    updateTrunkSchema,
    type RegistrationMode,
    type Trunk,
    type TrunkCreateForm,
    type TrunkUpdateForm,
} from "@/hooks/use-trunks"

const REGISTRATION_MODES = [
    { value: "outbound", label: "Outbound (registra no provedor)" },
    { value: "inbound", label: "Inbound (recebe registro)" },
]

type Props =
    | {
        open: boolean
        onOpenChange: (open: boolean) => void
        trunk: null
        companies: Company[]
        onCreate: (form: TrunkCreateForm) => Promise<Trunk | null>
        onUpdate?: never
    }
    | {
        open: boolean
        onOpenChange: (open: boolean) => void
        trunk: Trunk
        companies: Company[]
        onCreate?: never
        onUpdate: (form: TrunkUpdateForm) => Promise<boolean>
    }

export function TrunkFormDialog({
    open,
    onOpenChange,
    trunk,
    companies,
    onCreate,
    onUpdate,
}: Props) {
    const isEdit = !!trunk

    const createForm = useForm<TrunkCreateForm>({
        resolver: zodResolver(createTrunkSchema) as any,
        defaultValues: {
            registrationMode: "outbound",
            name: "",
            companyId: "",
            codecs: "ulaw,alaw",
            host: "",
            port: undefined,
            username: "",
            password: "",
        } as any,
    })

    const createRegistrationMode = useWatch({
        control: createForm.control,
        name: "registrationMode",
    }) as RegistrationMode
    const registrationMode = isEdit
        ? trunk.registrationMode
        : createRegistrationMode
    const isInboundMode = registrationMode === "inbound"

    const updateForm = useForm<TrunkUpdateForm>({
        resolver: zodResolver(updateTrunkSchema) as any,
    })

    useEffect(() => {
        if (!open) return
        if (isEdit) {
            updateForm.reset({
                host: trunk.host ?? "",
                port: trunk.port ?? undefined,
                username: trunk.username ?? "",
                password: trunk.password ?? "",
                codecs: trunk.codecs,
                maxInChannels: trunk.maxInChannels ?? undefined,
                maxOutChannels: trunk.maxOutChannels ?? undefined,
            })
        } else {
            createForm.reset({
                registrationMode: "outbound",
                name: "",
                companyId: "",
                codecs: "ulaw,alaw",
                host: "",
                port: undefined,
                username: "",
                password: "",
            } as any)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isEdit, trunk])

    const handleCreate = createForm.handleSubmit(async (form) => {
        const result = await onCreate!(form)
        if (result) onOpenChange(false)
    })

    const handleUpdate = updateForm.handleSubmit(async (form) => {
        const ok = await onUpdate!(form)
        if (ok) onOpenChange(false)
    })

    const r = isEdit ? updateForm.register : createForm.register
    const control = isEdit ? updateForm.control : createForm.control
    const errors = isEdit
        ? updateForm.formState.errors
        : createForm.formState.errors
    const isSubmitting = isEdit
        ? updateForm.formState.isSubmitting
        : createForm.formState.isSubmitting

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar tronco" : "Novo tronco"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `${trunk.name} — ${
                                  trunk.registrationMode === "outbound"
                                      ? "Outbound"
                                      : `Inbound (identificado por ${trunk.identifyBy === "username" ? "usuário" : "IP"})`
                              }`
                            : "Preencha os dados para criar o tronco"}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="trunk-form"
                    onSubmit={isEdit ? handleUpdate : handleCreate}
                >
                    <FieldGroup>
                        {!isEdit && (
                            <Field>
                                <FieldLabel>Modo de registro</FieldLabel>
                                <Controller
                                    control={createForm.control}
                                    name="registrationMode"
                                    render={({ field }) => (
                                        <Select
                                            items={REGISTRATION_MODES}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REGISTRATION_MODES.map((m) => (
                                                    <SelectItem
                                                        key={m.value}
                                                        value={m.value}
                                                    >
                                                        {m.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>
                        )}

                        {!isEdit && (
                            <Field>
                                <FieldLabel>Nome</FieldLabel>
                                <Input
                                    placeholder="Ex: provedor-voip"
                                    {...createForm.register("name")}
                                />
                                {createForm.formState.errors.name && (
                                    <FieldError>
                                        {
                                            createForm.formState.errors.name
                                                .message as string
                                        }
                                    </FieldError>
                                )}
                            </Field>
                        )}

                        {!isEdit && (
                            <Field>
                                <FieldLabel>Empresa</FieldLabel>
                                <Controller
                                    control={createForm.control}
                                    name="companyId"
                                    render={({ field }) => {
                                        const sel =
                                            companies.find(
                                                (c) => c.id === field.value
                                            ) ?? null
                                        return (
                                            <Combobox<Company>
                                                items={companies}
                                                value={sel}
                                                itemToStringLabel={(c) => c.name}
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                onValueChange={(company) =>
                                                    field.onChange(
                                                        company?.id ?? ""
                                                    )
                                                }
                                            >
                                                <ComboboxInput placeholder="Buscar empresa..." />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        Nenhuma empresa
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(company: Company) => (
                                                            <ComboboxItem
                                                                key={company.id}
                                                                value={company}
                                                            >
                                                                {company.name}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                        )
                                    }}
                                />
                                {createForm.formState.errors.companyId && (
                                    <FieldError>
                                        {
                                            createForm.formState.errors
                                                .companyId.message as string
                                        }
                                    </FieldError>
                                )}
                            </Field>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <Field className="col-span-2">
                                <FieldLabel>
                                    Host
                                    {isInboundMode ? " (opcional)" : ""}
                                </FieldLabel>
                                <Input
                                    placeholder="sip.provedor.com.br"
                                    {...r("host")}
                                />
                                {errors.host && (
                                    <FieldError>
                                        {errors.host.message as string}
                                    </FieldError>
                                )}
                                {isInboundMode && (
                                    <FieldDescription>
                                        Sem usuário, a identificação da
                                        chamada é feita pelo host (IP).
                                        Informando um usuário, a identificação
                                        passa a ser por usuário/senha.
                                    </FieldDescription>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel>Porta</FieldLabel>
                                <Input
                                    type="number"
                                    placeholder="5060"
                                    {...r("port")}
                                />
                                {errors.port && (
                                    <FieldError>
                                        {errors.port.message as string}
                                    </FieldError>
                                )}
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Field>
                                <FieldLabel>
                                    Usuário
                                    {isInboundMode ? " (opcional)" : ""}
                                </FieldLabel>
                                <Input {...r("username")} />
                                {errors.username && (
                                    <FieldError>
                                        {errors.username.message as string}
                                    </FieldError>
                                )}
                                {isEdit &&
                                    isInboundMode &&
                                    trunk.identifyBy === "ip" && (
                                        <FieldDescription>
                                            Tronco identifica por IP.
                                            Informando um usuário, passa a
                                            identificar por usuário/senha.
                                        </FieldDescription>
                                    )}
                            </Field>
                            <Field>
                                <FieldLabel>
                                    Senha
                                    {isInboundMode ? " (opcional)" : ""}
                                </FieldLabel>
                                <Input {...r("password")} />
                                {errors.password && (
                                    <FieldError>
                                        {errors.password.message as string}
                                    </FieldError>
                                )}
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel>Codecs</FieldLabel>
                            <Controller
                                control={control as any}
                                name="codecs"
                                render={({ field }) => (
                                    <CodecCheckboxes
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                            {errors.codecs && (
                                <FieldError>
                                    {errors.codecs.message as string}
                                </FieldError>
                            )}
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field>
                                <FieldLabel>Canais de entrada (máx)</FieldLabel>
                                <Input
                                    type="number"
                                    placeholder="Ilimitado"
                                    {...r("maxInChannels")}
                                />
                                {errors.maxInChannels && (
                                    <FieldError>
                                        {errors.maxInChannels.message as string}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel>Canais de saída (máx)</FieldLabel>
                                <Input
                                    type="number"
                                    placeholder="Ilimitado"
                                    {...r("maxOutChannels")}
                                />
                                {errors.maxOutChannels && (
                                    <FieldError>
                                        {errors.maxOutChannels.message as string}
                                    </FieldError>
                                )}
                            </Field>
                        </div>
                    </FieldGroup>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="trunk-form"
                        disabled={isSubmitting}
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
    )
}
