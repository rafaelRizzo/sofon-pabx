"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
    FileAudioIcon,
    Loader2Icon,
    PlayIcon,
    RefreshCwIcon,
    UploadIcon,
    XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, apiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AudioWaveform } from "@/components/ui/audio-waveform"
import { loadAudioFile, type Audio } from "@/hooks/use-audios"
import { useTtsVoices, type Voice } from "@/hooks/use-tts-voices"
import { VoicePreviewDots } from "@/components/Audios/voice-preview-dots"

const TTS_TEXT_MAX = 2500
const ALL_LANGUAGES = "all"

// Filtro de idioma restrito a português e inglês - os dois idiomas usados nesse sistema,
// não a lista completa suportada pela ElevenLabs
const TTS_LANGUAGES = ["pt", "en"]

const languageDisplayNames = new Intl.DisplayNames(["pt-BR"], {
    type: "language",
})

function languageLabel(code: string) {
    try {
        return languageDisplayNames.of(code) ?? code
    } catch {
        return code
    }
}

const SORTED_TTS_LANGUAGES = [...TTS_LANGUAGES].sort((a, b) =>
    languageLabel(a).localeCompare(languageLabel(b))
)

// base-ui Select precisa de `items` (value+label) pra exibir o label certo no trigger fechado,
// já que os <SelectItem> só existem no DOM quando o popup está aberto
const LANGUAGE_SELECT_ITEMS = [
    { value: ALL_LANGUAGES, label: "Todos os idiomas" },
    ...SORTED_TTS_LANGUAGES.map((code) => ({
        value: code,
        label: languageLabel(code),
    })),
]

const audioFormSchema = z
    .object({
        name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
        mode: z.enum(["upload", "tts"]),
        text: z.string().max(TTS_TEXT_MAX, "Máximo 2500 caracteres"),
        voiceId: z.string(),
    })
    .superRefine((data, ctx) => {
        if (data.mode !== "tts") return
        if (!data.text.trim()) {
            ctx.addIssue({ code: "custom", path: ["text"], message: "Informe o texto" })
        }
        if (!data.voiceId) {
            ctx.addIssue({ code: "custom", path: ["voiceId"], message: "Selecione uma voz" })
        }
    })

type AudioFormValues = z.infer<typeof audioFormSchema>

type TtsPayload = { text: string; voiceId: string; language: "pt" | "en" }

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    audio: Audio | null
    // empresa já escolhida na tela (filtro da tabela, ou a do áudio em edição) - não dá pra
    // trocar dentro do dialog, mesmo padrão de AnnouncementFormDialog/InboundRouteFormDialog
    companyId: string
    // null = falhou; string = audioId criado/editado (usado pra mostrar o preview após TTS)
    onSave: (
        form: AudioFormValues,
        file: File | null,
        tts: TtsPayload | null
    ) => Promise<string | null>
}

// .gsm não tem MIME type padrão no browser; validação cai pra extensão quando o MIME não vem
const AUDIO_EXTENSIONS = ["wav", "mp3", "gsm"]
const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(",")

function isAudioFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase()
    return !!ext && AUDIO_EXTENSIONS.includes(ext)
}

export function AudioFormDialog({
    open,
    onOpenChange,
    audio,
    companyId,
    onSave,
}: Props) {
    const isEdit = !!audio

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<AudioFormValues>({
        resolver: zodResolver(audioFormSchema),
        defaultValues: {
            name: "",
            mode: "upload",
            text: "",
            voiceId: "",
        },
    })

    const mode = watch("mode")
    const text = watch("text")
    const voiceId = watch("voiceId")

    const {
        voices,
        loading: loadingVoices,
        refreshing: refreshingVoices,
        refreshVoices,
    } = useTtsVoices(companyId, { enabled: mode === "tts" })

    const [languageFilter, setLanguageFilter] = useState(ALL_LANGUAGES)
    const filteredVoices = useMemo(
        () =>
            languageFilter === ALL_LANGUAGES
                ? voices
                : voices.filter((v) =>
                      (v.languages ?? []).includes(languageFilter)
                  ),
        [voices, languageFilter]
    )

    const selectedVoice = voices.find((v) => v.voiceId === voiceId) ?? null

    // Se a voz selecionada sair da lista ao trocar o filtro de idioma, limpa a seleção
    useEffect(() => {
        if (voiceId && !filteredVoices.some((v) => v.voiceId === voiceId)) {
            setValue("voiceId", "", { shouldValidate: true, shouldDirty: true })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [languageFilter])

    const [file, setFile] = useState<File | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
    const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(
        null
    )
    const previewAudioRef = useRef<HTMLAudioElement | null>(null)
    const previewObjectUrlRef = useRef<string | null>(null)

    function stopPreview() {
        previewAudioRef.current?.pause()
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current)
            previewObjectUrlRef.current = null
        }
    }

    // Player do áudio recém-gerado por TTS (o .wav final já convertido, via /audios/:id/file) -
    // diferente do togglePreview acima, que só toca a prévia curta da voz antes de gerar
    const [generatedAudioId, setGeneratedAudioId] = useState<string | null>(
        null
    )
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(
        null
    )

    useEffect(() => {
        if (!generatedAudioId) {
            setGeneratedAudioUrl(null)
            return
        }
        let cancelled = false
        let objectUrl: string | null = null
        setGeneratedAudioUrl(null)
        loadAudioFile(generatedAudioId).then((url) => {
            if (cancelled) return
            objectUrl = url
            setGeneratedAudioUrl(url)
        })
        return () => {
            cancelled = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [generatedAudioId])

    // Prévia gerada sob demanda no idioma selecionado (diferente do `previewUrl` fixo, geralmente
    // em inglês, que a ElevenLabs devolve em /audios/tts/voices)
    async function togglePreview(voice: Voice) {
        if (playingVoiceId === voice.voiceId) {
            stopPreview()
            setPlayingVoiceId(null)
            return
        }
        stopPreview()
        setPlayingVoiceId(null)
        setPreviewLoadingId(voice.voiceId)
        try {
            const language = languageFilter === ALL_LANGUAGES ? "pt" : languageFilter
            const res = await api.get("/audios/tts/preview", {
                params: { companyId, voiceId: voice.voiceId, language },
                responseType: "blob",
            })
            const url = URL.createObjectURL(res.data as Blob)
            previewObjectUrlRef.current = url
            const player = new window.Audio(url)
            player.onended = () => setPlayingVoiceId(null)
            previewAudioRef.current = player
            setPlayingVoiceId(voice.voiceId)
            await player.play()
        } catch (err) {
            toast.error(apiError(err, "Erro ao gerar prévia da voz"))
        } finally {
            setPreviewLoadingId(null)
        }
    }

    useEffect(() => {
        if (!open) return
        reset({
            name: audio?.name ?? "",
            mode: "upload",
            text: "",
            voiceId: "",
        })
        setFile(null)
        setFileError(null)
        setLanguageFilter(ALL_LANGUAGES)
        setGeneratedAudioId(null)
    }, [open, audio, reset])

    // Para a prévia ao fechar o dialog ou desmontar, sem depender do usuário clicar de novo
    useEffect(() => {
        if (!open) {
            stopPreview()
            setPlayingVoiceId(null)
            setGeneratedAudioId(null)
        }
        return () => {
            stopPreview()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function selectFile(selected: File | null) {
        if (selected && !isAudioFile(selected)) {
            setFileError(
                "Formato não suportado, veja os formatos aceitos abaixo"
            )
            setFile(null)
            return
        }
        setFileError(null)
        setFile(selected)
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        selectFile(e.target.files?.[0] ?? null)
    }

    const [dragOver, setDragOver] = useState(false)

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setDragOver(false)
        selectFile(e.dataTransfer.files?.[0] ?? null)
    }

    const onSubmit = handleSubmit(async (form) => {
        if (!isEdit && form.mode === "upload" && !file) {
            setFileError("Selecione um arquivo de áudio")
            return
        }
        const upload = !isEdit && form.mode === "upload" ? file : null
        const tts =
            !isEdit && form.mode === "tts"
                ? {
                      text: form.text,
                      voiceId: form.voiceId,
                      language: (languageFilter === ALL_LANGUAGES
                          ? "pt"
                          : languageFilter) as "pt" | "en",
                  }
                : null
        if (tts) setGeneratedAudioId(null)
        const audioId = await onSave(form, upload, tts)
        if (!audioId) return

        // TTS: mantém voz/idioma/texto selecionados e só limpa o nome, pra gerar vários áudios
        // seguidos com a mesma voz/texto sem reabrir o dialog e reselecionar tudo de novo
        if (tts) {
            setValue("name", "")
            setGeneratedAudioId(audioId)
            return
        }
        onOpenChange(false)
    })

    const hasChanges = isDirty || !!file

    // Fechar (X, Escape, clique fora, botão Cancelar) com alterações não salvas pede confirmação
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
    function requestClose(nextOpen: boolean) {
        if (!nextOpen && hasChanges) {
            setConfirmDiscardOpen(true)
            return
        }
        onOpenChange(nextOpen)
    }

    const title = isEdit
        ? "Renomear áudio"
        : mode === "tts"
          ? "Gerar áudio por voz"
          : "Enviar áudio"

    return (
        <>
            <Dialog open={open} onOpenChange={requestClose}>
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? `Apenas o nome pode ser alterado. Para trocar o conteúdo de "${audio.name}", delete este áudio e crie um novo.`
                                : mode === "tts"
                                  ? "Gere um áudio a partir de texto para usar em anúncios, URAs e filas"
                                  : "Envie um arquivo de áudio para usar em anúncios, URAs e filas"}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="audio-form"
                        onSubmit={onSubmit}
                        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
                    >
                        <ScrollArea className="min-h-0">
                            <FieldGroup className="pr-3">
                                <Field>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                        placeholder="Ex: boas-vindas"
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <FieldError>
                                            {errors.name.message}
                                        </FieldError>
                                    )}
                                </Field>

                                {!isEdit && (
                                    <Field>
                                        <Tabs
                                            value={mode}
                                            onValueChange={(v) =>
                                                setValue(
                                                    "mode",
                                                    v as "upload" | "tts",
                                                    { shouldDirty: true }
                                                )
                                            }
                                        >
                                            <TabsList className="w-full">
                                                <TabsTrigger value="upload">
                                                    Upload
                                                </TabsTrigger>
                                                <TabsTrigger value="tts">
                                                    Gerar por voz
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent
                                                value="upload"
                                                className="mt-3"
                                            >
                                                <Field className="gap-3">
                                                    <FieldLabel>
                                                        Arquivo
                                                    </FieldLabel>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept={AUDIO_ACCEPT}
                                                        className="hidden"
                                                        onChange={
                                                            handleFileChange
                                                        }
                                                    />
                                                    {file ? (
                                                        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                                            <FileAudioIcon className="size-4 shrink-0 text-muted-foreground" />
                                                            <span className="min-w-0 flex-1 truncate">
                                                                {file.name}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                onClick={() => {
                                                                    setFile(
                                                                        null
                                                                    )
                                                                    if (
                                                                        fileInputRef.current
                                                                    )
                                                                        fileInputRef.current.value =
                                                                            ""
                                                                }}
                                                            >
                                                                <XIcon />
                                                                <span className="sr-only">
                                                                    Remover
                                                                    arquivo
                                                                </span>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() =>
                                                                fileInputRef.current?.click()
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                        "Enter" ||
                                                                    e.key ===
                                                                        " "
                                                                ) {
                                                                    e.preventDefault()
                                                                    fileInputRef.current?.click()
                                                                }
                                                            }}
                                                            onDragOver={(
                                                                e
                                                            ) => {
                                                                e.preventDefault()
                                                                setDragOver(
                                                                    true
                                                                )
                                                            }}
                                                            onDragLeave={() =>
                                                                setDragOver(
                                                                    false
                                                                )
                                                            }
                                                            onDrop={
                                                                handleDrop
                                                            }
                                                            className={cn(
                                                                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors hover:border-foreground/25 hover:bg-accent/40",
                                                                dragOver &&
                                                                    "border-foreground/40 bg-accent/50"
                                                            )}
                                                        >
                                                            <UploadIcon className="size-5 text-muted-foreground" />
                                                            <p className="text-sm font-medium">
                                                                Arraste um
                                                                arquivo ou
                                                                clique para
                                                                selecionar
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                WAV, MP3 ou
                                                                GSM
                                                            </p>
                                                        </div>
                                                    )}
                                                    {fileError && (
                                                        <FieldError>
                                                            {fileError}
                                                        </FieldError>
                                                    )}
                                                    <FieldDescription>
                                                        Convertido
                                                        automaticamente para
                                                        WAV PCM 16-bit mono
                                                        8kHz (formato usado
                                                        pelo Asterisk), sem
                                                        perda de qualidade e
                                                        sem resample durante a
                                                        chamada.
                                                    </FieldDescription>
                                                </Field>
                                            </TabsContent>

                                            <TabsContent
                                                value="tts"
                                                className="mt-3 flex flex-col gap-4"
                                            >
                                                <Field>
                                                    <FieldLabel>
                                                        Idioma
                                                    </FieldLabel>
                                                    <Select
                                                        items={
                                                            LANGUAGE_SELECT_ITEMS
                                                        }
                                                        value={languageFilter}
                                                        onValueChange={(v) =>
                                                            setLanguageFilter(
                                                                v ??
                                                                    ALL_LANGUAGES
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem
                                                                value={
                                                                    ALL_LANGUAGES
                                                                }
                                                            >
                                                                Todos os
                                                                idiomas
                                                            </SelectItem>
                                                            {SORTED_TTS_LANGUAGES.map(
                                                                (code) => (
                                                                    <SelectItem
                                                                        key={
                                                                            code
                                                                        }
                                                                        value={
                                                                            code
                                                                        }
                                                                    >
                                                                        {languageLabel(
                                                                            code
                                                                        )}
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </Field>

                                                <Field>
                                                    <div className="flex items-center justify-between">
                                                        <FieldLabel>
                                                            Voz
                                                        </FieldLabel>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="xs"
                                                            disabled={
                                                                refreshingVoices
                                                            }
                                                            onClick={
                                                                refreshVoices
                                                            }
                                                        >
                                                            <RefreshCwIcon
                                                                className={cn(
                                                                    refreshingVoices &&
                                                                        "animate-spin"
                                                                )}
                                                            />
                                                            Atualizar
                                                        </Button>
                                                    </div>
                                                    <Combobox<Voice>
                                                        items={filteredVoices}
                                                        value={selectedVoice}
                                                        itemToStringLabel={(
                                                            v
                                                        ) => v.name}
                                                        isItemEqualToValue={(
                                                            a,
                                                            b
                                                        ) =>
                                                            a.voiceId ===
                                                            b.voiceId
                                                        }
                                                        onValueChange={(v) =>
                                                            setValue(
                                                                "voiceId",
                                                                v?.voiceId ??
                                                                    "",
                                                                {
                                                                    shouldValidate:
                                                                        true,
                                                                    shouldDirty:
                                                                        true,
                                                                }
                                                            )
                                                        }
                                                    >
                                                        <ComboboxInput
                                                            placeholder={
                                                                loadingVoices
                                                                    ? "Carregando vozes..."
                                                                    : "Buscar voz..."
                                                            }
                                                        />
                                                        <ComboboxContent>
                                                            <ComboboxEmpty>
                                                                Nenhuma voz
                                                                encontrada
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(
                                                                    v: Voice
                                                                ) => (
                                                                    <ComboboxItem
                                                                        key={
                                                                            v.voiceId
                                                                        }
                                                                        value={
                                                                            v
                                                                        }
                                                                    >
                                                                        <span className="min-w-0 flex-1 truncate">
                                                                            {
                                                                                v.name
                                                                            }
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon-xs"
                                                                            disabled={
                                                                                previewLoadingId ===
                                                                                v.voiceId
                                                                            }
                                                                            onClick={(
                                                                                e
                                                                            ) => {
                                                                                e.stopPropagation()
                                                                                togglePreview(
                                                                                    v
                                                                                )
                                                                            }}
                                                                            onPointerDown={(
                                                                                e
                                                                            ) =>
                                                                                e.stopPropagation()
                                                                            }
                                                                        >
                                                                            {previewLoadingId ===
                                                                            v.voiceId ? (
                                                                                <Loader2Icon className="animate-spin" />
                                                                            ) : playingVoiceId ===
                                                                              v.voiceId ? (
                                                                                <VoicePreviewDots />
                                                                            ) : (
                                                                                <PlayIcon />
                                                                            )}
                                                                            <span className="sr-only">
                                                                                Ouvir
                                                                                prévia
                                                                            </span>
                                                                        </Button>
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                    {errors.voiceId && (
                                                        <FieldError>
                                                            {
                                                                errors.voiceId
                                                                    .message
                                                            }
                                                        </FieldError>
                                                    )}
                                                </Field>

                                                <Field>
                                                    <FieldLabel>
                                                        Texto
                                                    </FieldLabel>
                                                    <Textarea
                                                        placeholder="Digite o texto que será convertido em áudio..."
                                                        rows={5}
                                                        {...register("text")}
                                                    />
                                                    {errors.text && (
                                                        <FieldError>
                                                            {
                                                                errors.text
                                                                    .message
                                                            }
                                                        </FieldError>
                                                    )}
                                                    <FieldDescription>
                                                        {text.length}/
                                                        {TTS_TEXT_MAX}{" "}
                                                        caracteres. Gerado via
                                                        ElevenLabs e
                                                        convertido
                                                        automaticamente para
                                                        WAV PCM 16-bit mono
                                                        8kHz.
                                                    </FieldDescription>
                                                </Field>

                                                {generatedAudioId && (
                                                    <Field>
                                                        <FieldLabel>
                                                            Áudio gerado
                                                        </FieldLabel>
                                                        <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-3">
                                                            {generatedAudioUrl ? (
                                                                <AudioWaveform
                                                                    src={
                                                                        generatedAudioUrl
                                                                    }
                                                                    autoPlay
                                                                />
                                                            ) : (
                                                                <div className="flex items-center justify-center py-2">
                                                                    <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Field>
                                                )}
                                            </TabsContent>
                                        </Tabs>
                                    </Field>
                                )}
                            </FieldGroup>
                        </ScrollArea>
                    </form>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => requestClose(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form="audio-form"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? isEdit
                                    ? "Salvando..."
                                    : mode === "tts"
                                      ? "Gerando..."
                                      : "Enviando..."
                                : isEdit
                                  ? "Salvar"
                                  : mode === "tts"
                                    ? "Gerar"
                                    : "Enviar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={confirmDiscardOpen}
                onOpenChange={setConfirmDiscardOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Descartar alterações?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem alterações não salvas
                            {isEdit
                                ? ` no áudio "${audio.name}"`
                                : " neste envio"}
                            . Se sair agora, elas serão perdidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Continuar editando
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                setConfirmDiscardOpen(false)
                                onOpenChange(false)
                            }}
                        >
                            Descartar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
