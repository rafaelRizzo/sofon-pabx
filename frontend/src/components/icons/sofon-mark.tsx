import { useId, type SVGProps } from "react"

// Logomark do Sofon: mesmo desenho do favicon (public/favicon.svg),
// referência ao sofon de "O Problema dos Três Corpos".
export function SofonMark(props: SVGProps<SVGSVGElement>) {
  const id = useId()
  const bgGradient = `${id}-bg`
  const orbGradient = `${id}-orb`

  return (
    <svg viewBox="0 0 32 32" {...props}>
      <defs>
        <radialGradient id={bgGradient} cx="50%" cy="42%" r="75%">
          <stop offset="0%" className="[stop-color:#e0e7ff] dark:[stop-color:#3730a3]" />
          <stop offset="100%" className="[stop-color:#c7d2fe] dark:[stop-color:#26225e]" />
        </radialGradient>
        <radialGradient id={orbGradient} cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="30%" stopColor="#818cf8" />
          <stop offset="65%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#312e81" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${bgGradient})`} />
      <circle cx="16" cy="16" r="12.5" fill={`url(#${orbGradient})`} />
      <ellipse
        cx="16"
        cy="16"
        rx="12.5"
        ry="4.2"
        fill="none"
        stroke="#e0e7ff"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="4.2"
        ry="12.5"
        fill="none"
        stroke="#e0e7ff"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <circle cx="16" cy="16" r="4.4" fill="#1e1b4b" />
      <circle cx="16" cy="16" r="2.6" fill="#ffffff" />
      <circle cx="14.9" cy="14.9" r="0.9" fill="#e0e7ff" />
    </svg>
  )
}
