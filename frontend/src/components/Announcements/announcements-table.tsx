"use client"

import { PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { RouteDestinationBadge } from "@/components/RouteDestination/route-destination-badge"
import { UsedByBadge } from "@/components/RouteDestination/used-by-badge"
import { type AnnouncementsTableProps } from "@/components/Announcements/types"

export function AnnouncementsTable({
    announcements,
    loading,
    companySelected,
    onPlay,
    onEdit,
    onDelete,
}: AnnouncementsTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Áudio</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Usado por</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : announcements.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum anúncio encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        announcements.map((announcement) => (
                            <TableRow key={announcement.id}>
                                <TableCell className="font-medium">
                                    {announcement.name}
                                </TableCell>
                                <TableCell>
                                    {announcement.hasAudio ? (
                                        <Badge
                                            variant="outline"
                                            className="gap-1.5 border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300"
                                        >
                                            Vinculado
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="text-muted-foreground"
                                        >
                                            Sem áudio
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <RouteDestinationBadge
                                        destination={announcement.destination}
                                    />
                                </TableCell>
                                <TableCell>
                                    <UsedByBadge usedBy={announcement.usedBy} />
                                </TableCell>
                                <TableCell>
                                    <TooltipProvider delay={100}>
                                        <div className="flex justify-end gap-1">
                                            {announcement.hasAudio && (
                                                <Tooltip>
                                                    <TooltipTrigger
                                                        render={
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() =>
                                                                    onPlay(
                                                                        announcement
                                                                    )
                                                                }
                                                            >
                                                                <PlayIcon />
                                                                <span className="sr-only">
                                                                    Ouvir
                                                                </span>
                                                            </Button>
                                                        }
                                                    />
                                                    <TooltipContent>
                                                        Ouvir áudio
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onEdit(
                                                                    announcement
                                                                )
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
                                                    Editar anúncio
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(
                                                                    announcement
                                                                )
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
                                                    Deletar anúncio
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
