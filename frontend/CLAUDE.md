# Sofon PABX - Frontend

## Stack
- Vite + React 19 + TanStack Router (file-based, `autoCodeSplitting`) + TanStack Query
- UI: shadcn/ui + Tailwind v4 + react-hook-form + zod (`zodResolver`)
- HTTP: axios (`lib/api.ts`), realtime: SSE manual (`lib/sse.ts`)
- Build/typecheck: `pnpm build` | `pnpm exec tsc --noEmit`

## Convenções
- Nunca fetch direto num componente/rota - sempre via hook (`hooks/use-<recurso>.ts`)
- Zod schema do hook deve espelhar `create<Nome>Schema`/`update<Nome>Schema` do backend - **não há geração automática de tipos**, é duplicação manual disciplinada, mantida em sincronia pelo subagent `api-contract-reviewer`. Ponto de risco de drift: ao mudar um schema no backend, revisar o hook correspondente.
- Nunca cor de paleta bruta (`text-gray-500`) nem `border` colorido + `bg/10` - usar a recipe de badge (ver seção shadcn abaixo)
- Componente shadcn novo só via `pnpm dlx shadcn@latest add <nome>`; variante nova estende o `cva` existente, nunca cria componente irmão do zero
- Ao criar tela/recurso novo, rodar `pnpm exec tsc --noEmit` (agent `build-checker`) pra validar

---

## Estrutura de pastas

```
src/
  routes/dashboard/<recurso-plural-kebab>.tsx  # rota (TanStack Router file-based)
  components/<Recurso>/                        # componentes de domínio (PascalCase)
  components/<generico>.tsx                    # genéricos soltos: page-header, confirm-delete-dialog, data-pagination
  components/ui/                               # primitivos shadcn puros (gerados via CLI)
  hooks/use-<recurso>.ts                       # tipo + schema Zod + fetch + query/mutations
  lib/                                         # api.ts, sse.ts, realtime-format.ts, utils.ts, auth-cookie.ts
```

`modules/` existe só pra um caso hoje (`modules/audit-logs`) - não é o padrão dominante, não seguir como referência.

## Padrão de feature (referência literal: `Companies`)

- **Rota** (`routes/dashboard/companies.tsx`): `createFileRoute("/dashboard/companies")({ component: CompaniesPage })`. A página só orquestra estado local (`formOpen`, `editing`, `deleting`) e monta `PageHeader` + tabela + form-dialog + `ConfirmDeleteDialog`. Sem lógica de fetch/negócio aqui.
- **Hook** (`hooks/use-companies.ts`):
  - `type Company` - espelha o shape de resposta do backend
  - `companyFormSchema` (Zod) com comentário `// Espelha create/updateCompanySchema do backend`
  - `fetchCompaniesRequest` + `useQuery({ queryKey: ["companies", ...escopo] })`
  - `useMutation` por operação (create/update/delete), cada uma envolta numa função que faz `toast.loading → mutateAsync → toast.success/error` via `apiError()` e retorna `Promise<boolean>`
- **Componentes** (`components/Companies/`): `companies-table.tsx` (tabela apresentacional, só recebe dados via props) e `company-form-dialog.tsx` (react-hook-form + `zodResolver(companyFormSchema)`)

Outros exemplos do mesmo trio hook + tabela + form-dialog + rota: `Trunks/`, `Queues/`, `Callcenter/` (`agent-scopes-panel.tsx`, `routing-rules-panel.tsx` etc).

## Client HTTP (`lib/api.ts`)

Instância axios única, `baseURL` de `VITE_API_URL`:
- Interceptor de request injeta `Authorization: Bearer` a partir de cookie
- Interceptor de response faz refresh de token compartilhado em 401 (evita múltiplos refreshes concorrentes disparados por requests simultâneos)
- `KNOWN_MESSAGES`/`STATUS_FALLBACK` traduzem erro do backend pra pt-BR - usar sempre `getErrorMessage`/`apiError` em vez de expor `error.message` cru

## Roteamento (TanStack Router)

File-based via `@tanstack/router-plugin/vite` (`vite.config.ts`). Convenções observadas:
- Rota filha: `dashboard/<recurso-plural-kebab>.tsx` (ex: `companies.tsx`, `trunks.tsx`, `time-conditions.tsx`)
- Rota aninhada com layout + índice + detalhe: `dashboard/flows.tsx` (layout) + `dashboard/flows.index.tsx` + `dashboard/flows.$id.tsx` (param dinâmico)
- Componente de página no mesmo arquivo da definição da rota (`export const Route = createFileRoute(...)` no fim do arquivo)

## shadcn - recipe de badge/status

Referência literal: `components/presence-badge.tsx` - `PRESENCE_CONFIG`/`CALL_STATE_CONFIG` como `Record<Enum, {label, className}>`, exportando `PresenceBadge`/`CallStateBadge` que envolvem `Badge variant="outline"` com `cn()`.

Padrão de classe pra paleta fixa de domínio:
```
border-transparent bg-<cor>-500/15 dark:bg-<cor>-400/20 dark:text-<cor>-300
```
Nunca `border` colorido + `bg/10`.

## Dialog com conteúdo rolável

`DialogContent` base (`components/ui/dialog.tsx`) já é `grid ... max-h-[85vh] overflow-y-auto` - serve puro pra dialog curto que nunca estoura a altura. Formulário longo (`ScrollArea` no corpo) **tem que** sobrescrever esse layout, senão o scroll do `DialogContent` some por cima do `ScrollArea` interno e o dialog inteiro rola junto (header e footer saem de tela). Referência literal: `components/Trunks/trunk-form-dialog.tsx`.

```tsx
<DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
    <DialogHeader>...</DialogHeader>

    <form
        id="..."
        onSubmit={...}
        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
    >
        <ScrollArea className="min-h-0">
            <FieldGroup className="pr-3">...</FieldGroup>
        </ScrollArea>
    </form>

    <DialogFooter>...</DialogFooter>
</DialogContent>
```

- `DialogContent`: `flex flex-col` (nunca o `grid` default) + `max-h-[90vh]` (ou `max-h-full` dentro de `NodeActionDialog`, que já limita a altura por fora)
- `form`/wrapper do `ScrollArea`: `grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]` - é o que faz o form ocupar só o espaço sobrando entre header e footer, sem estourar
- `ScrollArea`: `className="min-h-0"`, nunca altura fixa em `vh` (`h-[65vh]` etc. - não acompanha o tamanho real do header/footer e é a causa raiz do bug)
- `DialogHeader`/`DialogFooter`: sem className especial, ficam fixos naturalmente por serem irmãos do form dentro do `flex-col`

Dialog sem `ScrollArea` (form curto que nunca precisa rolar) fica com o `DialogContent` default, sem essa sobrescrita.

## Realtime (SSE)

Não é WebSocket nem polling do cliente - é Server-Sent Events, e o push só acontece quando o AMI reporta mudança no backend (ver `backend/src/asterisk/transport/ami-events.ts` + `realtime-bus.ts`), nunca por iniciativa do frontend.

- `lib/sse.ts`: como `EventSource` nativo não aceita header `Authorization`, a implementação usa `fetch()` + `ReadableStream` manual, parseando frames `data: ...\n\n`. Reconecta com backoff progressivo e reautentica via refresh de token em 401.
- `hooks/use-realtime.ts`: `useRealtimeExtensions/useRealtimeTrunks/useRealtimeQueues(companyId)`, cada um abre `openEventStream` pra `/realtime/<recurso>/stream` num `useEffect`. Tipos (`Presence`, `CallState`, `RealtimeExtension`, `RealtimeQueue`) espelham `backend/src/modules/realtime/schemas/realtime.schema.ts` - mesmo risco de drift do item de contrato acima.
- Consumo em componente: recebe os dados já resolvidos via hook (ex: `components/Monitoring/realtime-extension-cards.tsx`), renderiza com `PresenceBadge`/`CallStateBadge`. Sem fetch/stream dentro do componente apresentacional.

## Convenções de review

Ao terminar uma tela/recurso novo (skill `new-resource`), passar por:
1. `component-reviewer` - estrutura de pasta, `Props` como `type`, hook retornando objeto plano, `queryKey` com escopo completo, form sempre com `zodResolver`
2. `api-contract-reviewer` - compara `hooks/use-<recurso>.ts` com `backend/src/modules/<recurso>/schemas/<recurso>.schema.ts` (campos, enums, rota/verbo, `RouteDestination` compartilhado)
3. `build-checker` - `pnpm exec tsc --noEmit`
