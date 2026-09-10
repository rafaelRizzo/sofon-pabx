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
import { downloadAudioFile, loadAudioFile } from "@/hooks/use-audios"

type Props = {
    audioId: string | null
    name?: string
    onOpenChange: (open: boolean) => void
}

// Dialog genérico de reprodução de áudio, reaproveitado por Announcements e Áudios: mesmo
// padrão do CdrRecordingDialog (blob via api.get + AudioWaveform)
export function AudioPlayerDialog({ audioId, name, onOpenChange }: Props) {
    const { data: audioUrl = null, isFetching: loading } = useQuery({
        queryKey: ["audio-file", audioId],
        queryFn: () => loadAudioFile(audioId as string),
        enabled: !!audioId,
        gcTime: 0,
    })

    // Blob URL não sobrevive à troca de áudio (nova query) nem ao desmonte - revoga pra não
    // vazar memória, já que o cache do useQuery não sabe liberar recursos do navegador
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl)
        }
    }, [audioUrl])

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
