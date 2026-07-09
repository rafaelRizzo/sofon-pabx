"use client"

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
    fetchDestinationOptions,
    type DestinationOption,
} from "@/components/RouteDestination/route-destination-field"
import { useQueueMembers, type QueueMember } from "@/hooks/use-queue-members"
import { type Queue } from "@/hooks/use-queues"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    queue: Queue | null
}

function useCompanyExtensions(companyId?: string) {
    const [extensions, setExtensions] = useState<DestinationOption[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!companyId) {
            setExtensions([])
            return
        }
        let cancelled = false
        setLoading(true)
        fetchDestinationOptions("extension", companyId)
            .then((opts) => {
                if (!cancelled) setExtensions(opts)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [companyId])

    return { extensions, loading }
}

function MemberRow({
    member,
    label,
    onUpdate,
    onRemove,
}: {
    member: QueueMember
    label: string
    onUpdate: (memberId: string, form: { penalty?: number; paused?: boolean }) => void
    onRemove: (memberId: string) => void
}) {
    const [penalty, setPenalty] = useState(String(member.penalty))

    return (
        <div className="flex items-center gap-2 rounded-md border p-2">
            <div className="flex-1 truncate text-xs font-medium">{label}</div>
            <Input
                type="number"
                min={0}
                max={100}
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                onBlur={() => {
                    const next = Number(penalty)
                    if (!Number.isNaN(next) && next !== member.penalty) {
                        onUpdate(member.id, { penalty: next })
                    } else {
                        setPenalty(String(member.penalty))
                    }
                }}
                className="w-16"
                title="Penalidade"
            />
            <Switch
                checked={!member.paused}
                onCheckedChange={(checked) => onUpdate(member.id, { paused: !checked })}
                title="Ativo na fila"
            />
            <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={() => onRemove(member.id)}
            >
                <Trash2Icon />
                <span className="sr-only">Remover</span>
            </Button>
        </div>
    )
}

export function QueueMembersSheet({ open, onOpenChange, queue }: Props) {
    const { members, loading, addMember, updateMember, removeMember } = useQueueMembers(
        open ? queue?.id : undefined
    )
    const { extensions } = useCompanyExtensions(open ? queue?.companyId : undefined)

    const [selectedExtensionId, setSelectedExtensionId] = useState<string>("")
    const [penalty, setPenalty] = useState("0")
    const [paused, setPaused] = useState(false)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        if (!open) {
            setSelectedExtensionId("")
            setPenalty("0")
            setPaused(false)
        }
    }, [open])

    const availableExtensions = extensions.filter(
        (e) => !members.some((m) => m.extensionId === e.id)
    )
    const extensionLabel = (extensionId: string) =>
        extensions.find((e) => e.id === extensionId)?.label ?? extensionId
    const selectedExtension = availableExtensions.find((e) => e.id === selectedExtensionId) ?? null

    async function handleAdd() {
        if (!selectedExtensionId) return
        setAdding(true)
        const ok = await addMember({
            extensionId: selectedExtensionId,
            penalty: Number(penalty) || 0,
            paused,
        })
        setAdding(false)
        if (ok) {
            setSelectedExtensionId("")
            setPenalty("0")
            setPaused(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex flex-col gap-0 sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Membros da fila</SheetTitle>
                    <SheetDescription>
                        {queue ? `Ramais vinculados à fila ${queue.name}` : ""}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
                    <div className="flex flex-col gap-2">
                        {loading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))
                        ) : members.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum membro adicionado ainda</p>
                        ) : (
                            members.map((member) => (
                                <MemberRow
                                    key={member.id}
                                    member={member}
                                    label={extensionLabel(member.extensionId)}
                                    onUpdate={updateMember}
                                    onRemove={removeMember}
                                />
                            ))
                        )}
                    </div>

                    <div className="flex flex-col gap-2 border-t pt-4">
                        <span className="text-xs font-medium">Adicionar membro</span>
                        <Combobox<DestinationOption>
                            items={availableExtensions}
                            value={selectedExtension}
                            itemToStringLabel={(e) => e.label}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onValueChange={(e) => setSelectedExtensionId(e?.id ?? "")}
                        >
                            <ComboboxInput placeholder="Buscar ramal..." />
                            <ComboboxContent>
                                <ComboboxEmpty>
                                    {availableExtensions.length === 0
                                        ? "Nenhum ramal disponível para adicionar"
                                        : "Nenhum resultado para essa busca"}
                                </ComboboxEmpty>
                                <ComboboxList>
                                    {(e: DestinationOption) => (
                                        <ComboboxItem key={e.id} value={e}>
                                            {e.label}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>

                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={penalty}
                                onChange={(e) => setPenalty(e.target.value)}
                                className="w-20"
                                placeholder="Penalidade"
                            />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Switch checked={!paused} onCheckedChange={(c) => setPaused(!c)} />
                                Ativo
                            </div>
                            <Button
                                type="button"
                                className="ml-auto"
                                disabled={!selectedExtensionId || adding}
                                onClick={handleAdd}
                            >
                                <PlusIcon />
                                Adicionar
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
