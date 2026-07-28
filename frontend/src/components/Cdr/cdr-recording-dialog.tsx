"use client"

import { useEffect, useState } from "react"
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
import {
    downloadCdrRecording,
    loadCdrRecordingAudio,
    type CdrRecord,
} from "@/hooks/use-cdr"

function formatDateTime(value: string | null): string {
    if (!value) return "-"
    return new Date(value).toLocaleString("pt-BR")
}

type Props = {
    record: CdrRecord | null
    companyId: string
    onOpenChange: (open: boolean) => void
}

export function CdrRecordingDialog({ record, companyId, onOpenChange }: Props) {
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!record) return
        let cancelled = false
        let objectUrl: string | null = null

        setAudioUrl(null)
        setLoading(true)
        loadCdrRecordingAudio(record.id, companyId).then((url) => {
            if (cancelled) return
            objectUrl = url
            setLoading(false)
            setAudioUrl(url)
        })

        return () => {
            cancelled = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record?.id, companyId])

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
