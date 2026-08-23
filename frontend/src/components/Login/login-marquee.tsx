import * as React from "react"

import {
  Building2Icon,
  HashIcon,
  HeadphonesIcon,
  MessageSquareIcon,
  MicIcon,
  NetworkIcon,
  PhoneCallIcon,
  PhoneForwardedIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  PhoneMissedIcon,
  PhoneOutgoingIcon,
  RadioIcon,
  RouterIcon,
  ServerIcon,
  SignalIcon,
  UsersIcon,
  VoicemailIcon,
  Volume2Icon,
  WifiIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

type Tag = { icon: LucideIcon; label: string }

const ROWS: { tags: Tag[]; duration: number; reverse?: boolean }[] = [
  {
    duration: 52,
    tags: [
      { icon: PhoneIcon, label: "Ramal 1042" },
      { icon: HeadphonesIcon, label: "Ramal 1187" },
      { icon: Building2Icon, label: "Filial Matriz" },
      { icon: PhoneIcon, label: "Ramal 1263" },
    ],
  },
  {
    duration: 38,
    reverse: true,
    tags: [
      { icon: NetworkIcon, label: "Tronco 01" },
      { icon: PhoneCallIcon, label: "Ramal 2201" },
      { icon: WifiIcon, label: "Filial SP" },
      { icon: PhoneCallIcon, label: "Ramal 2340" },
    ],
  },
  {
    duration: 34,
    tags: [
      { icon: HashIcon, label: "Ramal 3390" },
      { icon: VoicemailIcon, label: "Caixa Postal" },
      { icon: PhoneForwardedIcon, label: "Ramal 3512" },
      { icon: HashIcon, label: "Ramal 3078" },
    ],
  },
  {
    duration: 46,
    reverse: true,
    tags: [
      { icon: RadioIcon, label: "Tronco 02" },
      { icon: SignalIcon, label: "Filial RJ" },
      { icon: MessageSquareIcon, label: "Ramal 4420" },
      { icon: SignalIcon, label: "Ramal 4187" },
    ],
  },
  {
    duration: 60,
    tags: [
      { icon: Building2Icon, label: "Filial BH" },
      { icon: PhoneIncomingIcon, label: "Ramal 2755" },
      { icon: HeadphonesIcon, label: "Ramal 2891" },
      { icon: Building2Icon, label: "Filial POA" },
    ],
  },
  {
    duration: 44,
    reverse: true,
    tags: [
      { icon: PhoneOutgoingIcon, label: "Ramal 5044" },
      { icon: UsersIcon, label: "Fila Suporte" },
      { icon: RouterIcon, label: "Tronco 03" },
      { icon: PhoneOutgoingIcon, label: "Ramal 5219" },
    ],
  },
  {
    duration: 30,
    tags: [
      { icon: MicIcon, label: "Ramal 6103" },
      { icon: Volume2Icon, label: "Ramal 6288" },
      { icon: ServerIcon, label: "Filial Curitiba" },
      { icon: MicIcon, label: "Ramal 6350" },
    ],
  },
  {
    duration: 56,
    reverse: true,
    tags: [
      { icon: Building2Icon, label: "Filial Recife" },
      { icon: PhoneMissedIcon, label: "Ramal 7042" },
      { icon: NetworkIcon, label: "Tronco 04" },
      { icon: Building2Icon, label: "Filial Fortaleza" },
    ],
  },
  {
    duration: 40,
    tags: [
      { icon: HeadphonesIcon, label: "Ramal 8110" },
      { icon: HashIcon, label: "Ramal 8225" },
      { icon: WifiIcon, label: "Filial Salvador" },
      { icon: VoicemailIcon, label: "Ramal 8390" },
    ],
  },
]

function Row({ tags, duration, reverse }: (typeof ROWS)[number]) {
  const unit = [...tags, ...tags, ...tags]
  const doubled = [...unit, ...unit]
  return (
    <div
      className="animate-marquee flex w-max shrink-0 gap-4"
      style={
        {
          "--marquee-duration": `${duration}s`,
          "--marquee-direction": reverse ? "reverse" : "normal",
        } as React.CSSProperties
      }
    >
      {doubled.map((tag, i) => (
        <span
          key={i}
          className="group flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/4 px-4 py-2 whitespace-nowrap transition-colors duration-200 hover:border-transparent hover:bg-indigo-500/15 dark:hover:bg-indigo-400/20"
        >
          <tag.icon className="size-3.5 text-foreground/35 transition-colors duration-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300" />
          <span className="font-mono text-[11px] tracking-wide text-foreground/35 uppercase transition-colors duration-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
            {tag.label}
          </span>
        </span>
      ))}
    </div>
  )
}

export function LoginMarquee({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 overflow-hidden select-none", className)}
    >
      <div className="absolute inset-0 flex scale-110 flex-col justify-between gap-14 rotate-[-7deg]">
        {ROWS.map((row, i) => (
          <Row key={i} {...row} />
        ))}
      </div>
    </div>
  )
}
