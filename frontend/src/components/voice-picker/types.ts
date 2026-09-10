import { type ReactNode } from "react"

import { type VoiceOrbState } from "@/components/voice-picker/voice-orb"

export type VoiceOrbBoundaryProps = { fallback: ReactNode; children: ReactNode }

export type VoiceOrbProps = {
    colors?: [string, string]
    colorsRef?: React.RefObject<[string, string]>
    resizeDebounce?: number
    seed?: number
    agentState?: VoiceOrbState
    volumeMode?: "auto" | "manual"
    manualInput?: number
    manualOutput?: number
    inputVolumeRef?: React.RefObject<number>
    outputVolumeRef?: React.RefObject<number>
    getInputVolume?: () => number
    getOutputVolume?: () => number
    className?: string
}
