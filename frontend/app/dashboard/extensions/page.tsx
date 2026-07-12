"use client"

import { useState } from "react"
import { CopyIcon, DownloadIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CompanyFilter } from "@/components/company-filter"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { DataPagination } from "@/components/data-pagination"
import { ExtensionFormDialog } from "@/components/Extensions/extension-form-dialog"
import { ExtensionsTable } from "@/components/Extensions/extensions-table"
import { PageHeader } from "@/components/page-header"
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
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCompanies, type Company } from "@/hooks/use-companies"
import { useCompanyFilter } from "@/hooks/use-company-filter"
import {
    useExtensions,
    type Extension,
    type ExtensionCreateForm,
    type ExtensionType,
    type ExtensionUpdateForm,
} from "@/hooks/use-extensions"
import { usePagination } from "@/hooks/use-pagination"

type PasswordReveal = { alias: string; username: string; password: string }

const TYPE_FILTERS = [
    { value: "all", label: "Todos os tipos" },
    { value: "sip", label: "SIP" },
    { value: "pjsip", label: "PJSIP" },
]

export default function ExtensionsPage() {
    const { companies } = useCompanies()
    const [typeFilter, setTypeFilter] = useState<ExtensionType | "all">("all")
    const [companyFilter, setCompanyFilter] = useCompanyFilter()

    const {
        extensions,
        loading,
        filter,
        setFilter,
        createExtension,
        updateExtension,
        resetPassword,
        deleteExtension,
        exportExtensions,
    } = useExtensions(companyFilter)

    const [createOpen, setCreateOpen] = useState(false)
    const [editExtension, setEditExtension] = useState<Extension | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Extension | null>(null)
    const [resetTarget, setResetTarget] = useState<Extension | null>(null)
    const [resetting, setResetting] = useState(false)
    const [passwordReveal, setPasswordReveal] =
        useState<PasswordReveal | null>(null)

    const filteredExtensions = extensions.filter(
        (e) => typeFilter === "all" || e.type === typeFilter
    )

    const { paginated, page, setPage, totalPages, total } = usePagination(
        filteredExtensions,
        15
    )

    const handleCreate = async (form: ExtensionCreateForm) => {
        const result = await createExtension(form)
        if (result) {
            setPasswordReveal({
                alias: form.alias,
                username: result.username,
                password: result.password,
            })
        }
        return result
    }

    const handleUpdate = async (form: ExtensionUpdateForm) => {
        if (!editExtension) return false
        return updateExtension(editExtension.id, form)
    }

    const handleConfirmResetPassword = async () => {
        if (!resetTarget) return
        setResetting(true)
        const password = await resetPassword(resetTarget.id)
        setResetting(false)
        if (password) {
            setPasswordReveal({
                alias: resetTarget.alias,
                username: resetTarget.username,
                password,
            })
            setResetTarget(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return false
        return deleteExtension(deleteTarget.id)
    }

    const copyPassword = () => {
        if (!passwordReveal) return
        navigator.clipboard.writeText(passwordReveal.password)
        toast.success("Senha copiada!")
    }

    const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

    const handleExport = async () => {
        const exported = await exportExtensions()
        if (!exported || exported.length === 0) return

        const getCompanyName = (companyId: string) =>
            companies.find((c) => c.id === companyId)?.name ?? companyId

        const header = ["Ramal", "Nome", "Empresa", "Tipo", "Usuário", "Senha"]
        const rows = exported.map((e) => [
            e.alias,
            e.name,
            getCompanyName(e.companyId),
            e.type.toUpperCase(),
            e.username,
            e.password,
        ])
        const csv = [header, ...rows]
            .map((row) => row.map(csvCell).join(","))
            .join("\n")

        const blob = new Blob([`﻿${csv}`], {
            type: "text/csv;charset=utf-8;",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "ramais.csv"
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Ramais"
                description="Gerencie os ramais SIP e PJSIP"
            >
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <DownloadIcon />
                        Exportar
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon />
                        Novo ramal
                    </Button>
                </div>
            </PageHeader>

            <div className="flex gap-2">
                <Input
                    placeholder="Buscar por ramal, nome..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm"
                />
                <CompanyFilter
                    companies={companies}
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                />
                <Select
                    items={TYPE_FILTERS}
                    value={typeFilter}
                    onValueChange={(v) =>
                        setTypeFilter(v as ExtensionType | "all")
                    }
                >
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TYPE_FILTERS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                                {t.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <ExtensionsTable
                extensions={paginated}
                companies={companies}
                loading={loading}
                onEdit={setEditExtension}
                onResetPassword={setResetTarget}
                onDelete={setDeleteTarget}
            />

            <DataPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
            />

            <ExtensionFormDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                extension={null}
                companies={companies}
                onCreate={handleCreate}
            />

            {editExtension && (
                <ExtensionFormDialog
                    open={!!editExtension}
                    onOpenChange={(open) => !open && setEditExtension(null)}
                    extension={editExtension}
                    companies={companies}
                    onUpdate={handleUpdate}
                />
            )}

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Deletar ramal"
                itemName={
                    deleteTarget
                        ? `${deleteTarget.alias} — ${deleteTarget.name}`
                        : ""
                }
                onConfirm={handleDelete}
            />

            <AlertDialog
                open={!!resetTarget}
                onOpenChange={(open) => {
                    if (!open && !resetting) setResetTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resetar senha</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja resetar a senha do ramal{" "}
                            <strong>
                                {resetTarget?.alias} — {resetTarget?.name}
                            </strong>
                            ? A senha atual deixará de funcionar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={resetting}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={resetting}
                            onClick={handleConfirmResetPassword}
                        >
                            {resetting ? "Resetando..." : "Resetar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!passwordReveal}
                onOpenChange={(open) => !open && setPasswordReveal(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Ramal {passwordReveal?.alias} criado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Guarde as credenciais — a senha não será exibida
                            novamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1 rounded-md border bg-muted px-3 py-2 text-sm">
                            <span className="text-xs text-muted-foreground">
                                Usuário SIP
                            </span>
                            <span className="font-mono select-all">
                                {passwordReveal?.username}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                            <div className="flex flex-1 flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Senha
                                </span>
                                <span className="font-mono select-all">
                                    {passwordReveal?.password}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={copyPassword}
                            >
                                <CopyIcon />
                            </Button>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <Button onClick={() => setPasswordReveal(null)}>
                            Fechar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
