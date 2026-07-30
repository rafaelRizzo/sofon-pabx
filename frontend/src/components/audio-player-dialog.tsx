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
import { downloadAudioFile, loadAudioFile } from "@/hooks/use-audios"

type Props = {
    audioId: string | null
    name?: string
    onOpenChange: (open: boolean) => void
}

// Dialog genérico de reprodução de áudio, reaproveitado por Announcements e Áudios: mesmo
// padrão do CdrRecordingDialog (blob via api.get + AudioWaveform)
export function AudioPlayerDialog({ audioId, name, onOpenChange }: Props) {
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!audioId) return
        let cancelled = false
        let objectUrl: string | null = null

        setAudioUrl(null)
        setLoading(true)
        loadAudioFile(audioId).then((url) => {
            if (cancelled) return
            objectUrl = url
            setLoading(false)
            setAudioUrl(url)
        })

        return () => {
            cancelled = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [audioId])

    return (
        <Dialog open={!!audioId} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ouvir áudio</DialogTitle>
                    {name && <DialogDescription>{name}</DialogDescription>}
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
                        Não foi possível carregar o áudio
                    </p>
                )}

                {audioId && (
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => downloadAudioFile(audioId, name)}
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
