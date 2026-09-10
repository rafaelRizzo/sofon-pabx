"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, Loader2Icon } from "lucide-react"

import { AudioWaveform } from "@/components/ui/audio-waveform"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { downloadCdrRecording, loadCdrRecordingAudio } from "@/hooks/use-cdr"
import { type CdrRecordingDialogProps } from "@/components/Cdr/types"

function formatDateTime(value: string | null): string {
    if (!value) return "-"
    return new Date(value).toLocaleString("pt-BR")
}

export function CdrRecordingDialog({
    record,
    companyId,
    onOpenChange,
}: CdrRecordingDialogProps) {
    const { data: audioUrl = null, isFetching: loading } = useQuery({
        queryKey: ["cdr-recording-audio", record?.id, companyId],
        queryFn: () => loadCdrRecordingAudio(record!.id, companyId),
        enabled: !!record,
        gcTime: 0,
    })

    // Blob URL não sobrevive à troca de gravação (nova query) nem ao desmonte - revoga pra não
    // vazar memória, já que o cache do useQuery não sabe liberar recursos do navegador
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl)
        }
    }, [audioUrl])

    return (
        <Dialog open={!!record} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gravação da chamada</DialogTitle>
                    {record && (
                        <DialogDescription>
                            {(record.originExtension || record.src) ?? "-"}
                            {" → "}
                            {(record.destinationLabel ||
                                record.dialedNumber ||
                                record.dst) ??
                                "-"}
                            {" · "}
                            {formatDateTime(record.startTime)}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                    </div>
                ) : audioUrl ? (
                    <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-3">
                        <AudioWaveform src={audioUrl} autoPlay />
                    </div>
                ) : (
                    <p className="py-4 text-center text-muted-foreground">
                        Não foi possível carregar a gravação
                    </p>
                )}

                {record && (
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() =>
                                downloadCdrRecording(record.id, companyId)
                            }
                        >
                            <DownloadIcon />
                            Baixar
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
