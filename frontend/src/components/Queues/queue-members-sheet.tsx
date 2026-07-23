"use client"

import { useEffect, useState } from "react"
import { InfoIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { NumberInput } from "@/components/ui/number-input"
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
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    fetchDestinationOptions,
    type DestinationOption,
} from "@/components/RouteDestination/route-destination-field"
import { useQueueMembers, type QueueMember } from "@/hooks/use-queue-members"
import { type Queue } from "@/hooks/use-queues"
import { cn } from "@/lib/utils"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    queue: Queue | null
}

// Colunas compartilhadas pelo cabeçalho e por cada MemberRow — grid (não flex com larguras
// soltas) garante que rótulo e valor fiquem sempre alinhados verticalmente.
const MEMBER_ROW_COLS = "grid-cols-[1fr_3.5rem_6rem_1.75rem]"

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

// Tooltip explicando o campo de prioridade — reaproveitado no cabeçalho da lista e no
// formulário de adicionar membro, já que o número sozinho ("penalty" do Asterisk) não é
// autoexplicativo: quanto menor, mais cedo o ramal recebe chamadas.
function PriorityHint() {
    return (
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
            <TooltipContent side="top">
                Define a ordem de atendimento: quanto menor o número, mais cedo
                esse ramal recebe chamadas. Ramais com o mesmo valor têm a mesma
                prioridade.
            </TooltipContent>
        </Tooltip>
    )
}

function MemberStatusLabel({ paused }: { paused: boolean }) {
    return (
        <span
            className={cn(
                "text-xs font-medium",
                paused
                    ? "text-muted-foreground"
                    : "text-emerald-600 dark:text-emerald-400"
            )}
        >
            {paused ? "Pausado" : "Disponível"}
        </span>
    )
}

function MemberRow({
    member,
    label,
    onUpdate,
    onRemove,
}: {
    member: QueueMember
    label: string
    onUpdate: (
        memberId: string,
        form: { penalty?: number; paused?: boolean }
    ) => void
    onRemove: (memberId: string) => void
}) {
    const [penalty, setPenalty] = useState(String(member.penalty))

    return (
        <div
            className={cn(
                "grid items-center gap-2 rounded-md border p-2",
                MEMBER_ROW_COLS
            )}
        >
            <div className="truncate text-xs font-medium">{label}</div>
            <NumberInput
                min={0}
                max={99}
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
                className="h-7 justify-self-center text-center"
                aria-label="Prioridade"
            />
            <div className="flex items-center gap-1.5">
                <Switch
                    checked={!member.paused}
                    onCheckedChange={(checked) =>
                        onUpdate(member.id, { paused: !checked })
                    }
                    aria-label={
                        member.paused
                            ? "Pausado, clique para reativar"
                            : "Disponível, clique para pausar"
                    }
                />
                <MemberStatusLabel paused={member.paused} />
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="justify-self-end text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemove(member.id)}
            >
                <Trash2Icon />
                <span className="sr-only">Remover</span>
            </Button>
        </div>
    )
}

export function QueueMembersSheet({ open, onOpenChange, queue }: Props) {
    const { members, loading, addMember, updateMember, removeMember } =
        useQueueMembers(open ? queue?.id : undefined)
    const { extensions } = useCompanyExtensions(
        open ? queue?.companyId : undefined
    )

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
    const selectedExtension =
        availableExtensions.find((e) => e.id === selectedExtensionId) ?? null

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
                        {!loading && members.length > 0 && (
                            <div
                                className={cn(
                                    "grid items-center gap-2 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
                                    MEMBER_ROW_COLS
                                )}
                            >
                                <span>Ramal</span>
                                <span className="flex items-center justify-center gap-1">
                                    Prior.
                                    <PriorityHint />
                                </span>
                                <span>Status</span>
                                <span />
                            </div>
                        )}
                        {loading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))
                        ) : members.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Nenhum membro adicionado ainda
                            </p>
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
                        <span className="text-xs font-medium">
                            Adicionar membro
                        </span>
                        <Combobox<DestinationOption>
                            items={availableExtensions}
                            value={selectedExtension}
                            itemToStringLabel={(e) => e.label}
                            isItemEqualToValue={(a, b) => a.id === b.id}
                            onValueChange={(e) =>
                                setSelectedExtensionId(e?.id ?? "")
                            }
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

                        <div className="flex items-end gap-3">
                            <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    Prioridade
                                    <PriorityHint />
                                </span>
                                <NumberInput
                                    min={0}
                                    max={99}
                                    value={penalty}
                                    onChange={(e) => setPenalty(e.target.value)}
                                    className="w-16 text-center"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    Status inicial
                                </span>
                                <div className="flex h-7 items-center gap-1.5">
                                    <Switch
                                        checked={!paused}
                                        onCheckedChange={(c) => setPaused(!c)}
                                    />
                                    <MemberStatusLabel paused={paused} />
                                </div>
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
