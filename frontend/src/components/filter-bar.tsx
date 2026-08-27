type FilterBarProps = {
    children: React.ReactNode
}

// Empilha em 1 coluna até md, vira row a partir daí - usado nas páginas de listagem
// que combinam busca por texto + filtro de empresa (+ filtros extras como tipo)
export function FilterBar({ children }: FilterBarProps) {
    return <div className="flex flex-col gap-2 md:flex-row">{children}</div>
}
