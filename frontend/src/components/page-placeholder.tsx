// Placeholder pra rotas ainda não portadas do frontend Next.js — cada uma vira uma página
// real conforme a migração incremental avança
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">
        Ainda não migrado do frontend Next.js.
      </p>
    </div>
  )
}
