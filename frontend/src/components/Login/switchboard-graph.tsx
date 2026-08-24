import type { CSSProperties } from "react"
import {
  Building2Icon,
  NetworkIcon,
  PhoneIcon,
  RadioIcon,
  UsersIcon,
  VoicemailIcon,
  type LucideIcon,
} from "lucide-react"

import { SofonMark } from "@/components/icons/sofon-mark"
import { cn } from "@/lib/utils"

const SIZE = 520
const CENTER = SIZE / 2
const RADIUS = 195

type Line = { label: string; icon: LucideIcon; angle: number }

const LINES: Line[] = [
  { label: "Ramal", icon: PhoneIcon, angle: -90 },
  { label: "Tronco", icon: NetworkIcon, angle: -30 },
  { label: "Fila", icon: UsersIcon, angle: 30 },
  { label: "Filial", icon: Building2Icon, angle: 90 },
  { label: "URA", icon: RadioIcon, angle: 150 },
  { label: "Caixa postal", icon: VoicemailIcon, angle: 210 },
]

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

const NODES = LINES.map((line, i) => {
  const rad = toRad(line.angle)
  const x = CENTER + RADIUS * Math.cos(rad)
  const y = CENTER + RADIUS * Math.sin(rad)
  const path = `M${CENTER},${CENTER} L${x},${y}`
  const duration = 3.8 + i * 0.55
  const begin = i * 0.85

  return { ...line, x, y, path, duration, begin }
})

export function SwitchboardGraph({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS + 55}
          fill="none"
          strokeWidth={1}
          strokeDasharray="1 10"
          className="switchboard-ring text-foreground/15"
          stroke="currentColor"
        />

        {NODES.map((node) => (
          <path
            key={`line-${node.label}`}
            d={node.path}
            fill="none"
            strokeWidth={1.25}
            className="text-foreground/12"
            stroke="currentColor"
          />
        ))}

        {NODES.map((node) => (
          <g key={`pulse-${node.label}`}>
            <circle
              r={16}
              className="switchboard-arrival fill-primary blur-[3px]"
              style={
                {
                  "--sb-duration": `${node.duration}s`,
                  "--sb-delay": `${node.begin}s`,
                  transformOrigin: `${node.x}px ${node.y}px`,
                } as CSSProperties
              }
              cx={node.x}
              cy={node.y}
            />
            <circle
              r={3.5}
              className="switchboard-packet fill-primary"
              style={
                {
                  "--sb-duration": `${node.duration}s`,
                  "--sb-delay": `${node.begin}s`,
                  offsetPath: `path('${node.path}')`,
                } as CSSProperties
              }
            />
          </g>
        ))}
      </svg>

      {NODES.map((node) => (
        <span
          key={node.label}
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-foreground/10 bg-background/80 px-2 py-1 whitespace-nowrap shadow-sm backdrop-blur-sm"
          style={{
            left: `${(node.x / SIZE) * 100}%`,
            top: `${(node.y / SIZE) * 100}%`,
          }}
        >
          <node.icon className="size-3 text-foreground/50" />
          <span className="font-mono text-[10px] tracking-wide text-foreground/60 uppercase">
            {node.label}
          </span>
        </span>
      ))}

      <div className="switchboard-orb pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <SofonMark className="size-11 rounded-xl shadow-[0_0_40px_-6px_var(--color-primary)]" />
      </div>
    </div>
  )
}
