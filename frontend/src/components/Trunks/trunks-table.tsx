"use client"

import { useState } from "react"
import { InfinityIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { PresenceBadge } from "@/components/presence-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { type RealtimeTrunk } from "@/hooks/use-realtime"
import { type Trunk } from "@/hooks/use-trunks"

const CODEC_PREVIEW_COUNT = 3

function CodecBadges({ codecs }: { codecs: string }) {
    const [expanded, setExpanded] = useState(false)
    const list = codecs
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    const visible = expanded ? list : list.slice(0, CODEC_PREVIEW_COUNT)
    const hidden = list.length - visible.length

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visible.map((codec) => (
                <Badge key={codec} variant="outline" className="font-mono text-xs">
                    {codec}
                </Badge>
            ))}
            {hidden > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-5 gap-0.5 px-1.5 text-xs"
                    onClick={() => setExpanded(true)}
                >
                    <PlusIcon className="size-3" />
                    {hidden}
                </Button>
            )}
            {expanded && list.length > CODEC_PREVIEW_COUNT && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs text-muted-foreground"
                    onClick={() => setExpanded(false)}
                >
                    ocultar
                </Button>
            )}
        </div>
    )
}

type Props = {
    trunks: Trunk[]
    realtimeTrunks: RealtimeTrunk[]
    loading: boolean
    companySelected: boolean
    onEdit: (trunk: Trunk) => void
    onDelete: (trunk: Trunk) => void
    onToggleActive: (trunk: Trunk, active: boolean) => void
}

export function TrunksTable({
    trunks,
    realtimeTrunks,
    loading,
    companySelected,
    onEdit,
    onDelete,
    onToggleActive,
}: Props) {
    const presenceById = new Map(
        realtimeTrunks.map((rt) => [rt.id, rt.presence])
    )

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Codecs</TableHead>
                        <TableHead className="text-center">
                            Canais (in/out)
                        </TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 9 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : trunks.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={9}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum tronco encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        trunks.map((trunk) => (
                            <TableRow key={trunk.id}>
                                <TableCell className="font-medium">
                                    {trunk.name}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            (trunk.type ?? "pjsip") === "pjsip"
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {(trunk.type ?? "pjsip").toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            trunk.registrationMode ===
                                            "outbound"
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {trunk.registrationMode === "outbound"
                                            ? "Outbound"
                                            : `Inbound (${trunk.identifyBy === "username" ? "usuário" : "IP"})`}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <PresenceBadge
                                        presence={
                                            presenceById.get(trunk.id) ??
                                            "unknown"
                                        }
                                    />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                    {trunk.host
                                        ? `${trunk.host}${trunk.port ? `:${trunk.port}` : ""}`
                                        : "-"}
                                </TableCell>
                                <TableCell>
                                    <CodecBadges codecs={trunk.codecs} />
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    <div className="flex items-center justify-center gap-1">
                                        {trunk.maxInChannels ?? (
                                            <InfinityIcon className="size-3.5" />
                                        )}
                                        <span>/</span>
                                        {trunk.maxOutChannels ?? (
                                            <InfinityIcon className="size-3.5" />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Switch
                                            checked={trunk.active}
                                            onCheckedChange={(checked) =>
                                                onToggleActive(trunk, checked)
                                            }
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {trunk.active
                                                ? "Ativo"
                                                : "Inativo"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onEdit(trunk)
                                                            }
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">
                                                                Editar
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Editar tronco
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(trunk)
                                                            }
                                                        >
                                                            <Trash2Icon />
                                                            <span className="sr-only">
                                                                Deletar
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Deletar tronco
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
