"use client"

import { Fragment, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, WandSparklesIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { PERMISSION_RESOURCES } from "@/hooks/use-auth"
import { useCompanies } from "@/hooks/use-companies"
import { useExtensions, type Extension } from "@/hooks/use-extensions"
import {
    createUserSchema,
    updateUserSchema,
    type CreateUserForm,
    type User,
    type UserRole,
} from "@/hooks/use-users"
import { CompanySelect } from "./company-select"

const ROLES: { value: UserRole; label: string }[] = [
    { value: "user", label: "Usuário" },
    { value: "reseller", label: "Revenda" },
    { value: "admin", label: "Administrador" },
]

type UserFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: User | null
    onSave: (form: CreateUserForm) => Promise<boolean>
}

export function UserFormDialog({
    open,
    onOpenChange,
    user,
    onSave,
}: UserFormDialogProps) {
    const isEdit = !!user

    const [showPassword, setShowPassword] = useState(false)
    const { companies } = useCompanies()

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CreateUserForm>({
        // no edit a senha é opcional e o role não é enviado (PUT não aceita)
        resolver: isEdit
            ? zodResolver(updateUserSchema)
            : zodResolver(createUserSchema),
        defaultValues: {
            name: "",
            username: "",
            password: "",
            role: "user",
            permissions: [],
            companyIds: [],
            extensionId: null,
        },
    })

    // no edit, role não é editável (campo oculto); a visibilidade dos checkboxes segue o role
    // atual do usuário; no create, segue o role selecionado no form
    const watchedRole = useWatch({ control, name: "role" })
    const showPermissions = (isEdit ? user?.role : watchedRole) === "user"

    // ramal pra vincular (softphone WebRTC) — disponível no create e no update; useExtensions só
    // busca 1 empresa por vez, então usa a primeira selecionada (caso comum de 1 empresa só)
    const watchedCompanyIds = useWatch({ control, name: "companyIds" })
    const { extensions } = useExtensions(watchedCompanyIds?.[0])
    const pjsipExtensions = extensions.filter((e) => e.type === "pjsip")

    const generatePassword = () => {
        const charset =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*"
        const bytes = crypto.getRandomValues(new Uint32Array(20))
        const password = Array.from(
            bytes,
            (b) => charset[b % charset.length]
        ).join("")
        setValue("password", password, {
            shouldValidate: true,
            shouldDirty: true,
        })
        setShowPassword(true)
    }

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setShowPassword(false)
        onOpenChange(nextOpen)
    }

    useEffect(() => {
        if (open) {
            reset({
                name: user?.name ?? "",
                username: user?.username ?? "",
                password: "",
                role: user?.role ?? "user",
                permissions: user?.permissions ?? [],
                companyIds: user?.companies.map((c) => c.id) ?? [],
                extensionId: user?.extensionId ?? null,
            })
        }
    }, [open, user, reset])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) handleOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Editar usuário" : "Novo usuário"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Altere os dados do usuário"
                            : "Preencha os dados para criar o usuário"}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={onSubmit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="name">Nome</FieldLabel>
                                <Input
                                    id="name"
                                    placeholder="Nome completo"
                                    {...register("name")}
                                />
                                {errors.name && (
                                    <FieldError>
                                        {errors.name.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="username">
                                    E-mail
                                </FieldLabel>
                                <Input
                                    id="username"
                                    type="email"
                                    placeholder="usuario@empresa.com.br"
                                    autoComplete="off"
                                    {...register("username")}
                                />
                                {errors.username && (
                                    <FieldError>
                                        {errors.username.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="password">
                                    {isEdit ? "Nova senha (opcional)" : "Senha"}
                                </FieldLabel>
                                <div className="flex gap-2">
                                    <Input
                                        id="password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        autoComplete="new-password"
                                        className="flex-1"
                                        placeholder={
                                            isEdit
                                                ? "Deixe em branco para manter"
                                                : ""
                                        }
                                        {...register("password")}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOffIcon />
                                        ) : (
                                            <EyeIcon />
                                        )}
                                        <span className="sr-only">
                                            Mostrar senha
                                        </span>
                                    </Button>
                                    <TooltipProvider delay={100}>
                                        <Tooltip>
                                            <TooltipTrigger
                                                render={
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={
                                                            generatePassword
                                                        }
                                                    >
                                                        <WandSparklesIcon />
                                                        <span className="sr-only">
                                                            Gerar senha
                                                            aleatória
                                                        </span>
                                                    </Button>
                                                }
                                            />
                                            <TooltipContent>
                                                Gerar senha aleatória
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                {errors.password && (
                                    <FieldError>
                                        {errors.password.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel>Empresas</FieldLabel>
                                <Controller
                                    control={control}
                                    name="companyIds"
                                    render={({ field }) => (
                                        <CompanySelect
                                            companies={companies}
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                                {errors.companyIds && (
                                    <FieldError>
                                        {errors.companyIds.message}
                                    </FieldError>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel>
                                    Ramal (softphone WebRTC)
                                </FieldLabel>
                                <Controller
                                    control={control}
                                    name="extensionId"
                                    render={({ field }) => {
                                        const sel =
                                            pjsipExtensions.find(
                                                (e) => e.id === field.value
                                            ) ?? null
                                        return (
                                            <Combobox<Extension>
                                                items={pjsipExtensions}
                                                value={sel}
                                                itemToStringLabel={(e) =>
                                                    `${e.alias} — ${e.name}`
                                                }
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                onValueChange={(ext) =>
                                                    field.onChange(
                                                        ext?.id ?? null
                                                    )
                                                }
                                            >
                                                <ComboboxInput
                                                    placeholder="Buscar ramal..."
                                                    showClear
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        Nenhum ramal
                                                        encontrado
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(ext: Extension) => (
                                                            <ComboboxItem
                                                                key={ext.id}
                                                                value={ext}
                                                            >
                                                                {ext.alias} —{" "}
                                                                {ext.name}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                        )
                                    }}
                                />
                            </Field>
                            {!isEdit && (
                                <Field>
                                    <FieldLabel>Permissão</FieldLabel>
                                    <Controller
                                        control={control}
                                        name="role"
                                        render={({ field }) => (
                                            <Select
                                                items={ROLES}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ROLES.map((role) => (
                                                        <SelectItem
                                                            key={role.value}
                                                            value={role.value}
                                                        >
                                                            {role.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.role && (
                                        <FieldError>
                                            {errors.role.message}
                                        </FieldError>
                                    )}
                                </Field>
                            )}
                            {showPermissions && (
                                <Field>
                                    <FieldLabel>
                                        Permissões de acesso
                                    </FieldLabel>
                                    <Controller
                                        control={control}
                                        name="permissions"
                                        render={({ field }) => {
                                            const perms = field.value ?? []
                                            const has = (key: string) =>
                                                perms.includes(key)
                                            const setView = (
                                                resource: string,
                                                checked: boolean
                                            ) => {
                                                const next = checked
                                                    ? [
                                                          ...perms,
                                                          `${resource}:view`,
                                                      ]
                                                    : perms.filter(
                                                          (p) =>
                                                              p !==
                                                                  `${resource}:view` &&
                                                              p !==
                                                                  `${resource}:manage`
                                                      )
                                                field.onChange([
                                                    ...new Set(next),
                                                ])
                                            }
                                            const setManage = (
                                                resource: string,
                                                checked: boolean
                                            ) => {
                                                const next = checked
                                                    ? [
                                                          ...perms,
                                                          `${resource}:view`,
                                                          `${resource}:manage`,
                                                      ]
                                                    : perms.filter(
                                                          (p) =>
                                                              p !==
                                                              `${resource}:manage`
                                                      )
                                                field.onChange([
                                                    ...new Set(next),
                                                ])
                                            }
                                            return (
                                                <div className="rounded-md border p-3">
                                                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
                                                        <span className="font-medium text-muted-foreground">
                                                            Recurso
                                                        </span>
                                                        <span className="justify-self-center font-medium text-muted-foreground">
                                                            Ver
                                                        </span>
                                                        <span className="justify-self-center font-medium text-muted-foreground">
                                                            Gerenciar
                                                        </span>
                                                        <span>CDR</span>
                                                        <Checkbox
                                                            className="justify-self-center"
                                                            checked={has(
                                                                "cdr:view"
                                                            )}
                                                            onCheckedChange={(
                                                                c
                                                            ) =>
                                                                field.onChange(
                                                                    c === true
                                                                        ? [
                                                                              ...new Set(
                                                                                  [
                                                                                      ...perms,
                                                                                      "cdr:view",
                                                                                  ]
                                                                              ),
                                                                          ]
                                                                        : perms.filter(
                                                                              (
                                                                                  p
                                                                              ) =>
                                                                                  p !==
                                                                                  "cdr:view"
                                                                          )
                                                                )
                                                            }
                                                        />
                                                        <span />
                                                        {PERMISSION_RESOURCES.map(
                                                            (r) => (
                                                                <Fragment
                                                                    key={r.key}
                                                                >
                                                                    <span>
                                                                        {
                                                                            r.label
                                                                        }
                                                                    </span>
                                                                    <Checkbox
                                                                        className="justify-self-center"
                                                                        checked={has(
                                                                            `${r.key}:view`
                                                                        )}
                                                                        onCheckedChange={(
                                                                            c
                                                                        ) =>
                                                                            setView(
                                                                                r.key,
                                                                                c ===
                                                                                    true
                                                                            )
                                                                        }
                                                                    />
                                                                    <Checkbox
                                                                        className="justify-self-center"
                                                                        checked={has(
                                                                            `${r.key}:manage`
                                                                        )}
                                                                        onCheckedChange={(
                                                                            c
                                                                        ) =>
                                                                            setManage(
                                                                                r.key,
                                                                                c ===
                                                                                    true
                                                                            )
                                                                        }
                                                                    />
                                                                </Fragment>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                </Field>
                            )}
                        </FieldGroup>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
