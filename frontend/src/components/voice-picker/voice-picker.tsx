"use client"

// Porta local do componente oficial "voice-picker" do shadcn/ui (registry ui.elevenlabs.io),
// adaptada em 2 pontos:
// 1. Usa VoiceCommand/VoicePopover/VoiceOrb/VoiceAudioPlayerProvider (portas locais deste
//    mesmo diretório) em vez de @/components/ui/* - não mexe no Combobox (base-ui) já usado no
//    resto do app.
// 2. Prévia de áudio: se `getPreviewUrl` for passado, usa ele (assíncrono) em vez do
//    `voice.previewUrl` estático da ElevenLabs (que costuma vir só em inglês) - permite ao
//    caller gerar a prévia no idioma selecionado (ver /audios/tts/preview no audio-form-dialog).
import * as React from "react"
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js"
import { Check, ChevronsUpDown, Loader2, Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    VoiceAudioPlayerProvider,
    useVoiceAudioPlayer,
} from "@/components/voice-picker/voice-audio-player"
import {
    VoiceCommand,
    VoiceCommandEmpty,
    VoiceCommandGroup,
    VoiceCommandInput,
    VoiceCommandItem,
    VoiceCommandList,
} from "@/components/voice-picker/voice-command"
import { VoiceOrb } from "@/components/voice-picker/voice-orb"
import { VoiceOrbBoundary } from "@/components/voice-picker/voice-orb-boundary"
import {
    VoicePopover,
    VoicePopoverContent,
    VoicePopoverTrigger,
} from "@/components/voice-picker/voice-popover"

// Hash simples e determinístico (mesma voz = sempre a mesma cor) - não precisa ser criptográfico,
// só distribuir bem os hues
function hashHue(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    return hash % 360
}

// Cor do VoiceOrb (WebGL) varia por gênero da voz - "#CADCFC"/"#A0B9D1" é o duotone azul padrão
// do componente oficial da ElevenLabs (usado pra male/neutral/sem label); female ganha um duotone
// rosa equivalente em luminosidade/saturação, pra manter a mesma leitura "pastel" do original.
const ORB_COLORS_BY_GENDER: Record<string, [string, string]> = {
    female: ["#FBD2EC", "#D19FC0"],
    male: ["#CADCFC", "#A0B9D1"],
    neutral: ["#CADCFC", "#A0B9D1"],
}

function voiceOrbColors(gender?: string): [string, string] {
    if (!gender) return ORB_COLORS_BY_GENDER.male
    return ORB_COLORS_BY_GENDER[gender.toLowerCase()] ?? ORB_COLORS_BY_GENDER.male
}

// A lista de vozes não é virtualizada - com o VoiceOrb (WebGL) sempre montado em todo item (ver
// StaticVoiceAvatar acima), listas longas estouram o limite de contextos WebGL simultâneos do
// browser, e o Chromium/Edge desenha um "rosto triste" no canvas quando um contexto é perdido e
// não consegue mais ser recriado. Só mantém o Orb (canvas) vivo nos itens visíveis (+ margem de
// scroll); os demais caem no fallback estático até entrarem na área visível do ScrollArea.
function useIsNearViewport<T extends Element>(ref: React.RefObject<T | null>): boolean {
    const [isNear, setIsNear] = React.useState(false)

    React.useEffect(() => {
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(
            ([entry]) => setIsNear(entry.isIntersecting),
            { rootMargin: "150px 0px" }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [ref])

    return isNear
}


// Avatar estático por voz - usado só como fallback do VoiceOrbBoundary se o WebGL/textura falhar
// (rede, CSP, GPU indisponível); o VoiceOrb real (WebGL) é o estado padrão de todo item da lista,
// igual ao componente oficial da ElevenLabs. Duotone (2 stops próximos no círculo de matiz, baixa
// saturação) pra lembrar o par pastel do Orb real (`#CADCFC`/`#A0B9D1`) só que variando por voz -
// um conic-gradient de 3+ stops espalhados sempre acaba pintando o círculo inteiro de arco-íris
// (testado: toda voz fica com a mesma cara "roda colorida", não lê como cor distinta nenhuma).
function StaticVoiceAvatar({ voiceId }: { voiceId: string }) {
    const hue = hashHue(voiceId)
    return (
        <div
            className="size-full rounded-full"
            style={{
                background: `linear-gradient(135deg, hsl(${hue} 35% 60%), hsl(${(hue + 25) % 360} 30% 38%))`,
            }}
        />
    )
}

// voice.labels vem cru da ElevenLabs (inglês, snake_case tipo "middle_aged") - gender/age são um
// vocabulário fechado e pequeno, traduzidos por completo; accent é livre (dezenas de valores
// possíveis), então só traduz os mais comuns e cai num fallback "humanizado" (sem underscore,
// capitalizado) pros demais, em vez de esconder o dado
const GENDER_LABELS_PT: Record<string, string> = {
    male: "Masculino",
    female: "Feminino",
    neutral: "Neutro",
}

const AGE_LABELS_PT: Record<string, string> = {
    young: "Jovem",
    middle_aged: "Meia-idade",
    old: "Idoso",
}

const ACCENT_LABELS_PT: Record<string, string> = {
    brazilian: "Brasileiro",
    portuguese: "Português",
    american: "Americano",
    british: "Britânico",
    english: "Inglês",
    australian: "Australiano",
    canadian: "Canadense",
    indian: "Indiano",
    african: "Africano",
    irish: "Irlandês",
    scottish: "Escocês",
    welsh: "Galês",
    french: "Francês",
    german: "Alemão",
    italian: "Italiano",
    spanish: "Espanhol",
    swedish: "Sueco",
    nigerian: "Nigeriano",
    filipino: "Filipino",
    transatlantic: "Transatlântico",
}

function humanizeLabel(value: string, dictionary: Record<string, string>): string {
    const normalized = value.toLowerCase().trim()
    if (dictionary[normalized]) return dictionary[normalized]
    return normalized
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface VoicePickerProps {
    voices: ElevenLabs.Voice[]
    value?: string
    onValueChange?: (value: string) => void
    placeholder?: string
    className?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    getPreviewUrl?: (voice: ElevenLabs.Voice) => Promise<string | null>
}

function VoicePicker({
    voices,
    value,
    onValueChange,
    placeholder = "Selecione uma voz...",
    className,
    open,
    onOpenChange,
    getPreviewUrl,
}: VoicePickerProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen

    const selectedVoice = voices.find((v) => v.voiceId === value)

    return (
        <VoiceAudioPlayerProvider>
            <VoicePopover open={isOpen} onOpenChange={setIsOpen}>
                <VoicePopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpen}
                        className={cn("w-full justify-between font-normal", className)}
                    >
                        {selectedVoice ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="relative size-6 shrink-0 overflow-visible">
                                    <VoiceOrbBoundary
                                        fallback={<StaticVoiceAvatar voiceId={selectedVoice.voiceId} />}
                                    >
                                        <VoiceOrb
                                            agentState="thinking"
                                            colors={voiceOrbColors(selectedVoice.labels?.gender)}
                                            className="absolute inset-0"
                                        />
                                    </VoiceOrbBoundary>
                                </div>
                                <span className="truncate">{selectedVoice.name}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                </VoicePopoverTrigger>
                <VoicePopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <VoiceCommand>
                        <VoiceCommandInput placeholder="Buscar vozes..." />
                        <VoiceCommandList>
                            <VoiceCommandEmpty>Nenhuma voz encontrada.</VoiceCommandEmpty>
                            <VoiceCommandGroup>
                                {voices.map((voice) => (
                                    <VoicePickerItem
                                        key={voice.voiceId}
                                        voice={voice}
                                        isSelected={value === voice.voiceId}
                                        onSelect={() => {
                                            onValueChange?.(voice.voiceId!)
                                        }}
                                        getPreviewUrl={getPreviewUrl}
                                    />
                                ))}
                            </VoiceCommandGroup>
                        </VoiceCommandList>
                    </VoiceCommand>
                </VoicePopoverContent>
            </VoicePopover>
        </VoiceAudioPlayerProvider>
    )
}

interface VoicePickerItemProps {
    voice: ElevenLabs.Voice
    isSelected: boolean
    onSelect: () => void
    getPreviewUrl?: (voice: ElevenLabs.Voice) => Promise<string | null>
}

function VoicePickerItem({
    voice,
    isSelected,
    onSelect,
    getPreviewUrl,
}: VoicePickerItemProps) {
    const [isHovered, setIsHovered] = React.useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
    const player = useVoiceAudioPlayer()
    const avatarRef = React.useRef<HTMLDivElement>(null)
    const isNearViewport = useIsNearViewport(avatarRef)

    const itemId = voice.voiceId!
    const canPreview = !!voice.previewUrl || !!getPreviewUrl
    const isPlaying = player.isItemActive(itemId) && player.isPlaying
    const showOrb = isNearViewport || isHovered || isPlaying

    const handlePreview = React.useCallback(
        async (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()

            if (isPlaying) {
                player.pause()
                return
            }

            if (player.isItemActive(itemId) && player.activeItem) {
                player.play(player.activeItem)
                return
            }

            let src = voice.previewUrl ?? null
            if (getPreviewUrl) {
                setIsLoadingPreview(true)
                try {
                    src = await getPreviewUrl(voice)
                } finally {
                    setIsLoadingPreview(false)
                }
            }
            if (!src) return
            player.play({ id: itemId, src, data: voice })
        },
        [isPlaying, itemId, player, voice, getPreviewUrl]
    )

    return (
        <VoiceCommandItem
            value={itemId}
            keywords={[
                voice.name,
                voice.labels?.accent,
                voice.labels?.gender,
                voice.labels?.age,
                voice.labels?.description,
                voice.labels?.["use case"],
            ].filter((k): k is string => Boolean(k))}
            onSelect={onSelect}
            className="flex items-center gap-3"
        >
            <div
                ref={avatarRef}
                className="relative z-10 size-8 shrink-0 cursor-pointer overflow-visible"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={canPreview ? handlePreview : undefined}
            >
                {showOrb ? (
                    <VoiceOrbBoundary fallback={<StaticVoiceAvatar voiceId={itemId} />}>
                        <VoiceOrb
                            agentState={isPlaying ? "talking" : undefined}
                            colors={voiceOrbColors(voice.labels?.gender)}
                            className="pointer-events-none absolute inset-0"
                        />
                    </VoiceOrbBoundary>
                ) : (
                    <StaticVoiceAvatar voiceId={itemId} />
                )}
                {canPreview && (isHovered || isLoadingPreview) && (
                    <div className="pointer-events-none absolute inset-0 flex size-8 shrink-0 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-opacity hover:bg-black/50">
                        {isLoadingPreview ? (
                            <Loader2 className="size-3 animate-spin text-white" />
                        ) : isPlaying ? (
                            <Pause className="size-3 text-white" />
                        ) : (
                            <Play className="size-3 text-white" />
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{voice.name}</span>
                {voice.labels && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {voice.labels.accent && (
                            <span>{humanizeLabel(voice.labels.accent, ACCENT_LABELS_PT)}</span>
                        )}
                        {voice.labels.gender && <span>•</span>}
                        {voice.labels.gender && (
                            <span>{humanizeLabel(voice.labels.gender, GENDER_LABELS_PT)}</span>
                        )}
                        {voice.labels.age && <span>•</span>}
                        {voice.labels.age && (
                            <span>{humanizeLabel(voice.labels.age, AGE_LABELS_PT)}</span>
                        )}
                    </div>
                )}
            </div>

            <Check
                className={cn(
                    "ml-auto size-4 shrink-0",
                    isSelected ? "opacity-100" : "opacity-0"
                )}
            />
        </VoiceCommandItem>
    )
}

export { VoicePicker, VoicePickerItem }
