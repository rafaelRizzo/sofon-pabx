"use client"

import { useMemo } from "react"
import { UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CallStateBadge } from "@/components/presence-badge"
import { activeCallLabel } from "@/lib/realtime-format"
import type {
    RealtimeExtension,
    RealtimeQueueMember,
} from "@/hooks/use-realtime"

type Props = {
    members: RealtimeQueueMember[]
    // ligação ativa mostrada por membro vem do estado do ramal (rt:ext:calls:*), não é escopada
    // à fila - mas como um ramal só atende uma chamada por vez na prática, já resolve "quem esse
    // membro está atendendo agora"
    extensions: RealtimeExtension[]
}

export function QueueMembersPopover({ members, extensions }: Props) {
    const activeCallByExtensionId = useMemo(() => {
        const result = new Map<string, string>()
        for (const ext of extensions) {
            const call = ext.activeCalls[0]
            if (call) result.set(ext.id, activeCallLabel(call))
        }
        return result
    }, [extensions])

    if (members.length === 0) {
        return (
            <span className="text-xs text-muted-foreground">
                Nenhum membro
            </span>
        )
    }

    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button variant="ghost" size="sm" className="gap-1.5">
                        <UsersIcon />
                        {members.length}
                    </Button>
                }
            />
            <PopoverContent align="end" className="w-72 gap-0 p-0">
                <p className="px-2.5 pt-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
                    Membros ({members.length})
                </p>
                <ScrollArea className="h-64">
                    <ul className="flex flex-col gap-2 p-2.5 pt-0">
                        {members.map((member) => {
                            const activeCall = activeCallByExtensionId.get(
                                member.extensionId
                            )
                            return (
                                <li
                                    key={member.extensionId}
                                    className="flex flex-col gap-1 border-b border-border/50 pb-2 text-sm last:border-0 last:pb-0"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">
                                                {member.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {member.number}
                                            </p>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-2">
                                            {member.paused && (
                                                <Badge
                                                    variant="outline"
                                                    className="border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300"
                                                >
                                                    Pausado
                                                    {member.pauseReason
                                                        ? `: ${member.pauseReason}`
                                                        : ""}
                                                </Badge>
                                            )}
                                            <CallStateBadge
                                                callState={member.status}
                                            />
                                        </span>
                                    </div>
                                    {activeCall && (
                                        <p className="truncate text-xs text-muted-foreground">
                                            {activeCall}
                                        </p>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
