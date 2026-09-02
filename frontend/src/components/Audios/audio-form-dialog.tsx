"use client"

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
    FileAudioIcon,
    Loader2Icon,
    RefreshCwIcon,
    UploadIcon,
    XIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js"

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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AudioWaveform } from "@/components/ui/audio-waveform"
import { loadAudioFile, type Audio, type TtsVoiceSettings } from "@/hooks/use-audios"
import { useTtsVoices } from "@/hooks/use-tts-voices"

// Lazy: o VoicePicker (voice-picker/) carrega three.js/react-three-fiber (avatar animado),
// ~700KB - sem isso a rota /dashboard/audios inteira pagaria esse peso mesmo pra quem só
// faz upload de áudio, nunca abre a aba "Gerar por voz"
const VoicePicker = lazy(() =>
    import("@/components/voice-picker/voice-picker").then((m) => ({
        default: m.VoicePicker,
    }))
)

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

// Mesmos defaults de ElevenLabsProvider.DEFAULT_VOICE_SETTINGS no backend - mantém os sliders
// alinhados com o que a API usa quando o campo não é enviado
const DEFAULT_VOICE_SETTINGS: Required<TtsVoiceSettings> = {
    stability: 0.65,
    similarityBoost: 0.85,
    style: 0,
    speed: 1,
    speakerBoost: true,
}

const audioFormSchema = z
    .object({
        name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
        mode: z.enum(["upload", "tts"]),
        text: z.string().max(TTS_TEXT_MAX, "Máximo 2500 caracteres"),
        voiceId: z.string(),
        stability: z.number().min(0).max(1),
        similarityBoost: z.number().min(0).max(1),
        style: z.number().min(0).max(1),
        speed: z.number().min(0.7).max(1.2),
        speakerBoost: z.boolean(),
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

type TtsPayload = {
    text: string
    voiceId: string
    language: "pt" | "en"
    voiceSettings: TtsVoiceSettings
}

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

// Mesmo layout do painel de voice_settings da ElevenLabs (label + valor + slider + legenda dos
// extremos) - um componente só pra não repetir o mesmo bloco 4x em AudioFormDialog
function VoiceSettingSlider({
    label,
    value,
    min,
    max,
    minLabel,
    maxLabel,
    onValueChange,
}: {
    label: string
    value: number
    min: number
    max: number
    minLabel: string
    maxLabel: string
    onValueChange: (value: number) => void
}) {
    return (
        <Field>
            <div className="flex items-center justify-between">
                <FieldLabel>{label}</FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {value.toFixed(2)}
                </span>
            </div>
            <Slider
                min={min}
                max={max}
                step={0.01}
                value={[value]}
                onValueChange={(v) =>
                    onValueChange(Array.isArray(v) ? v[0] : v)
                }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
        </Field>
    )
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
            ...DEFAULT_VOICE_SETTINGS,
        },
    })

    const mode = watch("mode")
    const text = watch("text")
    const voiceId = watch("voiceId")
    const stability = watch("stability")
    const similarityBoost = watch("similarityBoost")
    const style = watch("style")
    const speed = watch("speed")
    const speakerBoost = watch("speakerBoost")

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

    // VoicePicker (voice-picker/) espera o shape ElevenLabs.Voice (labels aninhado) - adapta a
    // partir do formato flat que a API deste backend retorna (ver use-tts-voices.ts)
    const elevenLabsVoices = useMemo<ElevenLabs.Voice[]>(
        () =>
            filteredVoices.map((v) => ({
                voiceId: v.voiceId,
                name: v.name,
                previewUrl: v.previewUrl ?? undefined,
                labels: {
                    ...(v.accent && { accent: v.accent }),
                    ...(v.gender && { gender: v.gender }),
                    ...(v.age && { age: v.age }),
                    ...(v.description && { description: v.description }),
                },
            })),
        [filteredVoices]
    )

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

    // Blob URLs criadas pela prévia de voz (ver getVoicePreviewUrl) - revogadas ao fechar o
    // dialog (efeito abaixo), já que o VoicePicker (voice-picker/) toca via <audio src>, não
    // controlamos o player diretamente daqui
    const previewUrlsRef = useRef<string[]>([])

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
    // em inglês, que a ElevenLabs devolve em /audios/tts/voices) - passado como `getPreviewUrl`
    // pro VoicePicker, que toca o resultado via seu próprio player (voice-audio-player.tsx)
    async function getVoicePreviewUrl(voice: ElevenLabs.Voice): Promise<string | null> {
        try {
            const language = languageFilter === ALL_LANGUAGES ? "pt" : languageFilter
            const res = await api.get("/audios/tts/preview", {
                params: { companyId, voiceId: voice.voiceId, language },
                responseType: "blob",
            })
            const url = URL.createObjectURL(res.data as Blob)
            previewUrlsRef.current.push(url)
            return url
        } catch (err) {
            toast.error(apiError(err, "Erro ao gerar prévia da voz"))
            return null
        }
    }

    useEffect(() => {
        if (!open) return
        reset({
            name: audio?.name ?? "",
            mode: "upload",
            text: "",
            voiceId: "",
            ...DEFAULT_VOICE_SETTINGS,
        })
        setFile(null)
        setFileError(null)
        setLanguageFilter(ALL_LANGUAGES)
        setGeneratedAudioId(null)
    }, [open, audio, reset])

    // Revoga as blob URLs de prévia de voz ao fechar o dialog ou desmontar
    useEffect(() => {
        if (!open) {
            previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
            previewUrlsRef.current = []
            setGeneratedAudioId(null)
        }
        return () => {
            previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
            previewUrlsRef.current = []
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
                      voiceSettings: {
                          stability: form.stability,
                          similarityBoost: form.similarityBoost,
                          style: form.style,
                          speed: form.speed,
                          speakerBoost: form.speakerBoost,
                      },
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
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden! sm:max-w-lg">
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
                                                    <Suspense
                                                        fallback={
                                                            <div className="flex h-9 w-full items-center rounded-md border px-3 text-sm text-muted-foreground">
                                                                Carregando...
                                                            </div>
                                                        }
                                                    >
                                                        <VoicePicker
                                                            voices={elevenLabsVoices}
                                                            value={voiceId}
                                                            onValueChange={(v) =>
                                                                setValue(
                                                                    "voiceId",
                                                                    v,
                                                                    {
                                                                        shouldValidate:
                                                                            true,
                                                                        shouldDirty:
                                                                            true,
                                                                    }
                                                                )
                                                            }
                                                            getPreviewUrl={
                                                                getVoicePreviewUrl
                                                            }
                                                            placeholder={
                                                                loadingVoices
                                                                    ? "Carregando vozes..."
                                                                    : "Selecione uma voz..."
                                                            }
                                                        />
                                                    </Suspense>
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

                                                <Accordion>
                                                    <AccordionItem value="advanced">
                                                        <AccordionTrigger>
                                                            Configurações avançadas
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="flex flex-col gap-4">
                                                                <VoiceSettingSlider
                                                                    label="Estabilidade"
                                                                    value={stability}
                                                                    min={0}
                                                                    max={1}
                                                                    minLabel="Mais variável"
                                                                    maxLabel="Mais estável"
                                                                    onValueChange={(v) =>
                                                                        setValue("stability", v, { shouldDirty: true })
                                                                    }
                                                                />

                                                                <VoiceSettingSlider
                                                                    label="Similaridade"
                                                                    value={similarityBoost}
                                                                    min={0}
                                                                    max={1}
                                                                    minLabel="Baixa"
                                                                    maxLabel="Alta"
                                                                    onValueChange={(v) =>
                                                                        setValue("similarityBoost", v, { shouldDirty: true })
                                                                    }
                                                                />

                                                                <VoiceSettingSlider
                                                                    label="Exagero de estilo"
                                                                    value={style}
                                                                    min={0}
                                                                    max={1}
                                                                    minLabel="Nenhum"
                                                                    maxLabel="Exagerado"
                                                                    onValueChange={(v) =>
                                                                        setValue("style", v, { shouldDirty: true })
                                                                    }
                                                                />

                                                                <VoiceSettingSlider
                                                                    label="Velocidade"
                                                                    value={speed}
                                                                    min={0.7}
                                                                    max={1.2}
                                                                    minLabel="Mais lento"
                                                                    maxLabel="Mais rápido"
                                                                    onValueChange={(v) =>
                                                                        setValue("speed", v, { shouldDirty: true })
                                                                    }
                                                                />

                                                                <Field orientation="horizontal">
                                                                    <FieldLabel htmlFor="speaker-boost">
                                                                        Speaker boost
                                                                    </FieldLabel>
                                                                    <Switch
                                                                        id="speaker-boost"
                                                                        checked={speakerBoost}
                                                                        onCheckedChange={(checked) =>
                                                                            setValue("speakerBoost", checked, { shouldDirty: true })
                                                                        }
                                                                    />
                                                                </Field>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>

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
