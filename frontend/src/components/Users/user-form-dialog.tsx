"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, SearchIcon, WandSparklesIcon } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
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
    type UserRole,
} from "@/hooks/use-users"
import { cn } from "@/lib/utils"
import { type UserFormDialogProps } from "@/components/Users/types"
import { CompanySelect } from "./company-select"

const ROLES: { value: UserRole; label: string }[] = [
    { value: "user", label: "Usuário" },
    { value: "admin", label: "Administrador" },
]

// CDR/Call Quality são só-leitura no backend (sem ação "manage", ver PERMISSION_KEYS em
// backend/src/utils/auth/permissions.ts) - entram na mesma lista/categoria pra render unificado.
// DIDs também é view-only aqui: criar/editar/excluir DID é admin-only por role (não por permissão
// granular) - só um admin pode disponibilizar/vincular número a uma empresa, nunca um "user" mesmo
// com a permissão concedida (a chave "dids:manage" nem existe pra conceder no backend)
const PERMISSION_ROWS = [
    { key: "cdr", label: "CDR", category: "Relatórios", manageable: false },
    { key: "call-quality", label: "Qualidade de rede", category: "Relatórios", manageable: false },
    { key: "dids", label: "DIDs", category: "Telefonia", manageable: false },
    ...PERMISSION_RESOURCES.map((r) => ({ ...r, manageable: true as const })),
]

const PERMISSION_CATEGORY_ORDER = [
    "Relatórios",
    "Administração",
    "Telefonia",
    "Roteamento",
    "Filas e atendimento",
    "Automação",
]

export function UserFormDialog({
    open,
    onOpenChange,
    user,
    onSave,
}: UserFormDialogProps) {
    const isEdit = !!user

    const [showPassword, setShowPassword] = useState(false)
    const [permissionSearch, setPermissionSearch] = useState("")
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
            notes: "",
        },
    })

    // no edit, role não é editável (campo oculto); a visibilidade dos checkboxes segue o role
    // atual do usuário; no create, segue o role selecionado no form
    const watchedRole = useWatch({ control, name: "role" })
    const showPermissions = (isEdit ? user?.role : watchedRole) === "user"

    // ramal pra vincular (softphone WebRTC) - disponível no create e no update; useExtensions só
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
                notes: user?.notes ?? "",
            })
            setPermissionSearch("")
        }
    }, [open, user, reset])

    const visiblePermissionRows = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase()
        if (!query) return PERMISSION_ROWS
        return PERMISSION_ROWS.filter(
            (r) =>
                r.label.toLowerCase().includes(query) ||
                r.category.toLowerCase().includes(query)
        )
    }, [permissionSearch])

    const permissionGroups = useMemo(
        () =>
            PERMISSION_CATEGORY_ORDER.map((category) => ({
                category,
                rows: visiblePermissionRows.filter((r) => r.category === category),
            })).filter((g) => g.rows.length > 0),
        [visiblePermissionRows]
    )

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) handleOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    "flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-md",
                    showPermissions && "sm:max-w-2xl"
                )}
            >
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
                    className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]"
                >
                    <ScrollArea className="min-h-0">
                        <FieldGroup className="pr-3">
                            <Field>
                                <FieldLabel htmlFor="name">Nome</FieldLabel>
                                <Input
                                    id="name"
                                    placeholder="Nome completo"
                                    maxLength={255}
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
                                    maxLength={255}
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
                                                    `${e.alias} - ${e.name}`
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
                                                                {ext.alias} -{" "}
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
                                    <p className="text-xs text-muted-foreground">
                                        Ver libera consultar o recurso.
                                        Gerenciar libera criar, editar e
                                        excluir - e já inclui Ver.
                                    </p>
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
                                            const markAllView = () => {
                                                const additions =
                                                    visiblePermissionRows.map(
                                                        (r) => `${r.key}:view`
                                                    )
                                                field.onChange([
                                                    ...new Set([
                                                        ...perms,
                                                        ...additions,
                                                    ]),
                                                ])
                                            }
                                            const markAllManage = () => {
                                                const additions =
                                                    visiblePermissionRows
                                                        .filter(
                                                            (r) =>
                                                                r.manageable
                                                        )
                                                        .flatMap((r) => [
                                                            `${r.key}:view`,
                                                            `${r.key}:manage`,
                                                        ])
                                                field.onChange([
                                                    ...new Set([
                                                        ...perms,
                                                        ...additions,
                                                    ]),
                                                ])
                                            }
                                            const clearVisible = () => {
                                                const keys = new Set(
                                                    visiblePermissionRows.flatMap(
                                                        (r) => [
                                                            `${r.key}:view`,
                                                            `${r.key}:manage`,
                                                        ]
                                                    )
                                                )
                                                field.onChange(
                                                    perms.filter(
                                                        (p) => !keys.has(p)
                                                    )
                                                )
                                            }
                                            return (
                                                <div className="flex flex-col gap-2 rounded-md border p-3">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="relative">
                                                            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                                            <Input
                                                                value={
                                                                    permissionSearch
                                                                }
                                                                onChange={(e) =>
                                                                    setPermissionSearch(
                                                                        e
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="Buscar recurso..."
                                                                className="h-8 w-full pl-7 sm:w-56"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                                                onClick={
                                                                    markAllView
                                                                }
                                                            >
                                                                Marcar Ver
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                                                onClick={
                                                                    markAllManage
                                                                }
                                                            >
                                                                Marcar
                                                                Gerenciar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                                                onClick={
                                                                    clearVisible
                                                                }
                                                            >
                                                                Limpar
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-1 text-xs font-medium text-muted-foreground">
                                                        <span>Recurso</span>
                                                        <span className="w-10 text-center">
                                                            Ver
                                                        </span>
                                                        <span className="w-16 text-center">
                                                            Gerenciar
                                                        </span>
                                                    </div>

                                                    <ScrollArea className="h-72">
                                                        {permissionGroups.length ===
                                                        0 ? (
                                                            <p className="py-4 text-center text-sm text-muted-foreground">
                                                                Nenhum recurso
                                                                encontrado
                                                            </p>
                                                        ) : (
                                                            <div className="flex flex-col gap-3 pr-3">
                                                                {permissionGroups.map(
                                                                    (
                                                                        group
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                group.category
                                                                            }
                                                                        >
                                                                            <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                                                {
                                                                                    group.category
                                                                                }
                                                                            </p>
                                                                            <div className="divide-y rounded-md border">
                                                                                {group.rows.map(
                                                                                    (
                                                                                        r
                                                                                    ) => (
                                                                                        <div
                                                                                            key={
                                                                                                r.key
                                                                                            }
                                                                                            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-2 py-1.5 text-sm hover:bg-muted/40"
                                                                                        >
                                                                                            <span>
                                                                                                {
                                                                                                    r.label
                                                                                                }
                                                                                            </span>
                                                                                            <div className="flex w-10 justify-center">
                                                                                                <Checkbox
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
                                                                                            </div>
                                                                                            <div className="flex w-16 justify-center">
                                                                                                {r.manageable ? (
                                                                                                    <Checkbox
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
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground">
                                                                                                        -
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    </ScrollArea>
                                                </div>
                                            )
                                        }}
                                    />
                                </Field>
                            )}
                            <Field>
                                <FieldLabel htmlFor="notes">
                                    Observação (opcional)
                                </FieldLabel>
                                <Textarea
                                    id="notes"
                                    placeholder="Anotações internas sobre o usuário"
                                    maxLength={10000}
                                    {...register("notes")}
                                />
                                {errors.notes && (
                                    <FieldError>
                                        {errors.notes.message}
                                    </FieldError>
                                )}
                            </Field>
                        </FieldGroup>
                    </ScrollArea>
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
