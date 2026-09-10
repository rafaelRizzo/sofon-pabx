"use client"

import {
    PencilIcon,
    PlayIcon,
    SparklesIcon,
    Trash2Icon,
} from "lucide-react"

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
import { type AudiosTableProps } from "@/components/Audios/types"

export function AudiosTable({
    audios,
    loading,
    companySelected,
    onPlay,
    onEdit,
    onDelete,
}: AudiosTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead className="w-30 text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 3 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : audios.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={3}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {companySelected
                                    ? "Nenhum áudio encontrado"
                                    : "Selecione uma empresa para listar"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        audios.map((audio) => (
                            <TableRow key={audio.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {audio.name}
                                        {audio.source === "TTS" && (
                                            <Badge
                                                variant="outline"
                                                className="border-transparent bg-violet-500/15 text-violet-600 dark:bg-violet-400/20 dark:text-violet-300"
                                            >
                                                <SparklesIcon />
                                                IA
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {new Date(audio.createdAt).toLocaleString(
                                        "pt-BR",
                                        {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        }
                                    )}
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
                                                                onPlay(audio)
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
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                onEdit(audio)
                                                            }
                                                        >
                                                            <PencilIcon />
                                                            <span className="sr-only">
                                                                Renomear
                                                            </span>
                                                        </Button>
                                                    }
                                                />
                                                <TooltipContent>
                                                    Renomear áudio
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger
                                                    render={
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() =>
                                                                onDelete(audio)
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
                                                    Deletar áudio
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
