"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, WandSparklesIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

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
import {
    createUserSchema,
    updateUserSchema,
    type CreateUserForm,
    type User,
    type UserRole,
} from "@/hooks/use-users"

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
        defaultValues: { name: "", username: "", password: "", role: "user" },
    })

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
            })
        }
    }, [open, user, reset])

    const onSubmit = handleSubmit(async (form) => {
        const ok = await onSave(form)
        if (ok) handleOpenChange(false)
    })

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
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
                <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto overflow-x-hidden flex-1">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="name">Nome</FieldLabel>
                            <Input
                                id="name"
                                placeholder="Nome completo"
                                {...register("name")}
                            />
                            {errors.name && (
                                <FieldError>{errors.name.message}</FieldError>
                            )}
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="username">E-mail</FieldLabel>
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
                                    type={showPassword ? "text" : "password"}
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
                                    onClick={() => setShowPassword((v) => !v)}
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
                                                    onClick={generatePassword}
                                                >
                                                    <WandSparklesIcon />
                                                    <span className="sr-only">
                                                        Gerar senha aleatória
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
