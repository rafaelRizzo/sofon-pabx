import type { CSSProperties } from "react"

import { SofonMark } from "@/components/icons/sofon-mark"
import { cn } from "@/lib/utils"

import { SwitchboardGraph } from "./switchboard-graph"

const FEED = [
  { route: "Ramal 1042 → Tronco 01", status: "Ativa", color: "bg-emerald-500" },
  { route: "Fila Suporte → Ramal 2340", status: "Tocando", color: "bg-amber-500" },
  { route: "Digite seu CPF → HTTP", status: "Consultando", color: "bg-indigo-500" },
]

export function LoginShowcase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden bg-gradient-to-b from-indigo-500/8 via-background to-background p-8 xl:p-10 dark:from-indigo-500/12",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <SofonMark className="size-6 shrink-0 rounded-md" />
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Central telefônica
        </span>
        <span
          aria-hidden="true"
          className="animate-lamp-pulse size-1.5 rounded-full bg-emerald-500"
          style={{ "--lamp-color": "oklch(0.72 0.19 145)" } as CSSProperties}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <SwitchboardGraph className="aspect-square h-[clamp(260px,36vh,400px)] w-auto" />

        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-balance">
              Sua central, sob controle total.
            </h2>
            <p className="text-sm text-muted-foreground text-balance">
              Ramais, troncos e filas configurados num painel só, sem tocar em
              linha de comando ou arquivo de config.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3">
            {FEED.map((item) => (
              <div
                key={item.route}
                className="flex items-center justify-between gap-4 font-mono text-[11px] text-foreground/40 uppercase"
              >
                <span className="tracking-wide">{item.route}</span>
                <span className="flex items-center gap-1.5 text-foreground/55">
                  <span className={cn("size-1.5 rounded-full", item.color)} />
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
