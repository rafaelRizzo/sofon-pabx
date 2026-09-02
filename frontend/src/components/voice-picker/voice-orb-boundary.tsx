import { Component, type ReactNode } from "react"

// VoiceOrb (voice-orb.tsx) carrega uma textura externa (perlin-noise.png) via
// react-three-fiber/drei - falha de rede/CSP nessa textura joga um erro não capturado que sobe
// até o error boundary mais próximo. Sem isso aqui, essa falha derruba a rota inteira (ver
// index.html, comentário do CSP) só por causa de um avatar decorativo. Precisa ser class
// component - React error boundary não tem equivalente em hook.
type Props = { fallback: ReactNode; children: ReactNode }
type State = { hasError: boolean }

export class VoiceOrbBoundary extends Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    render() {
        if (this.state.hasError) return this.props.fallback
        return this.props.children
    }
}
