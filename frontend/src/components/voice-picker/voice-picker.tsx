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
import {
    VoicePopover,
    VoicePopoverContent,
    VoicePopoverTrigger,
} from "@/components/voice-picker/voice-popover"

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
    placeholder = "Select a voice...",
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
                                    <VoiceOrb agentState="thinking" className="absolute inset-0" />
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
                        <VoiceCommandInput placeholder="Search voices..." />
                        <VoiceCommandList>
                            <VoiceCommandEmpty>No voice found.</VoiceCommandEmpty>
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

    const itemId = voice.voiceId!
    const canPreview = !!voice.previewUrl || !!getPreviewUrl
    const isPlaying = player.isItemActive(itemId) && player.isPlaying

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
                className="relative z-10 size-8 shrink-0 cursor-pointer overflow-visible"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={canPreview ? handlePreview : undefined}
            >
                <VoiceOrb
                    agentState={isPlaying ? "talking" : undefined}
                    className="pointer-events-none absolute inset-0"
                />
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
                        {voice.labels.accent && <span>{voice.labels.accent}</span>}
                        {voice.labels.gender && <span>•</span>}
                        {voice.labels.gender && (
                            <span className="capitalize">{voice.labels.gender}</span>
                        )}
                        {voice.labels.age && <span>•</span>}
                        {voice.labels.age && (
                            <span className="capitalize">{voice.labels.age}</span>
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
