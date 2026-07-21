"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useAgentScopes } from "@/hooks/use-agent-scopes"
import { useExtensions, type Extension } from "@/hooks/use-extensions"

type Props = {
    companyId: string
}

export function AgentScopesPanel({ companyId }: Props) {
    const { scopes, loading, createScope, toggleScopeActive, deleteScope } =
        useAgentScopes(companyId)
    const { extensions } = useExtensions(companyId)

    const [selectedExtensionId, setSelectedExtensionId] = useState<string>("")
    const [adding, setAdding] = useState(false)

    const extensionLabel = (extensionId: string) => {
        const ext = extensions.find((e) => e.id === extensionId)
        return ext ? `${ext.alias} - ${ext.name}` : extensionId
    }

    const availableExtensions = extensions.filter(
        (e) => !scopes.some((s) => s.extensionId === e.id)
    )
    const selectedExtension =
        availableExtensions.find((e) => e.id === selectedExtensionId) ?? null

    async function handleAdd() {
        if (!selectedExtensionId) return
        setAdding(true)
        const ok = await createScope({
            extensionId: selectedExtensionId,
            companyId,
            active: true,
        })
        setAdding(false)
        if (ok) setSelectedExtensionId("")
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Restringe quais ramais podem atender chamadas dessa empresa. Se
                nenhum ramal for vinculado aqui, todos os membros das filas
                continuam elegíveis normalmente.
            </p>

            <div className="flex items-end gap-2">
                <Combobox<Extension>
                    items={availableExtensions}
                    value={selectedExtension}
                    itemToStringLabel={(e) => `${e.alias} - ${e.name}`}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onValueChange={(e) => setSelectedExtensionId(e?.id ?? "")}
                >
                    <ComboboxInput
                        placeholder="Buscar ramal..."
                        className="w-72"
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>
                            {availableExtensions.length === 0
                                ? "Nenhum ramal disponível para vincular"
                                : "Nenhum resultado para essa busca"}
                        </ComboboxEmpty>
                        <ComboboxList>
                            {(e: Extension) => (
                                <ComboboxItem key={e.id} value={e}>
                                    {e.alias} - {e.name}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
                <Button
                    type="button"
                    disabled={!selectedExtensionId || adding}
                    onClick={handleAdd}
                >
                    <PlusIcon />
                    Vincular
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ramal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-16 text-right">
                                Ações
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 3 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : scopes.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Nenhum ramal vinculado: todos os membros das
                                    filas são elegíveis
                                </TableCell>
                            </TableRow>
                        ) : (
                            scopes.map((scope) => (
                                <TableRow key={scope.id}>
                                    <TableCell className="font-medium">
                                        {extensionLabel(scope.extensionId)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Switch
                                                checked={scope.active}
                                                onCheckedChange={(checked) =>
                                                    toggleScopeActive(
                                                        scope.id,
                                                        checked
                                                    )
                                                }
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                {scope.active
                                                    ? "Elegível"
                                                    : "Inelegível"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() =>
                                                deleteScope(scope.id)
                                            }
                                        >
                                            <Trash2Icon />
                                            <span className="sr-only">
                                                Remover
                                            </span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
