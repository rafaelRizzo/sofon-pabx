import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState, type ChangeEvent } from "react"
import { CameraIcon, Loader2Icon, TrashIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAuth, type AuthUser } from "@/hooks/use-auth"
import { useAvatarUrl, useProfileAvatar } from "@/hooks/use-profile"
import { getInitials } from "@/lib/utils"

const ROLE_LABELS: Record<AuthUser["role"], string> = {
    admin: "Administrador",
    reseller: "Revenda",
    user: "Usuário",
}

function ProfilePage() {
    const { user } = useAuth()
    const { uploadAvatar, removeAvatar } = useProfileAvatar()
    const avatarUrl = useAvatarUrl(user?.id, user?.avatarUpdatedAt)
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [removing, setRemoving] = useState(false)

    if (!user) return null

    const busy = uploading || removing

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return

        setUploading(true)
        await uploadAvatar(file)
        setUploading(false)
    }

    const handleRemove = async () => {
        setRemoving(true)
        await removeAvatar()
        setRemoving(false)
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <PageHeader
                title="Meu perfil"
                description="Gerencie sua foto e veja os dados da sua conta"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Foto de perfil</CardTitle>
                    <CardDescription>PNG ou JPEG, até 5MB.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-6">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                        className="group relative shrink-0 rounded-full outline-none disabled:cursor-not-allowed focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <Avatar className="size-24 ring-2 ring-border ring-offset-2 ring-offset-background">
                            <AvatarImage src={avatarUrl ?? undefined} alt={user.name} />
                            <AvatarFallback className="text-2xl">
                                {getInitials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white">
                            {uploading ? (
                                <Loader2Icon className="size-5 animate-spin" />
                            ) : (
                                <CameraIcon className="size-5" />
                            )}
                        </span>
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{user.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                                {user.username}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => inputRef.current?.click()}
                            >
                                {uploading ? (
                                    <Loader2Icon className="animate-spin" />
                                ) : (
                                    <CameraIcon />
                                )}
                                Alterar foto
                            </Button>
                            {user.avatarUpdatedAt && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={handleRemove}
                                >
                                    {removing ? (
                                        <Loader2Icon className="animate-spin" />
                                    ) : (
                                        <TrashIcon />
                                    )}
                                    Remover
                                </Button>
                            )}
                        </div>
                    </div>

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={handleFile}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Dados da conta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">Nome</span>
                        <span className="text-sm font-medium">{user.name}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">Usuário</span>
                        <span className="text-sm font-medium">{user.username}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">Papel</span>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {ROLE_LABELS[user.role]}
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export const Route = createFileRoute("/dashboard/profile")({ component: ProfilePage })
