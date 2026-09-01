---
name: new-resource
description: Gera a tela completa (hook + tabela + form-dialog + rota) de um recurso novo do backend, seguindo o padrão real deste frontend. Use quando o usuário pedir a UI de um módulo novo do backend (ex: "cria a tela de sms-templates").
---

# new-resource

Gera os arquivos de UI de um recurso que já existe (ou está sendo criado em paralelo) no backend, seguindo exatamente `src/hooks/use-companies.ts` + `src/components/Companies/` + `src/routes/dashboard/companies.tsx` como referência literal — não invente estrutura nova.

## Passo a passo

1. **Nome do recurso**: kebab-case pro arquivo de hook/rota (`sms-templates`), PascalCase pra pasta de componente (`SmsTemplates/`), singular pro tipo TypeScript (`SmsTemplate`).

2. **Antes de escrever qualquer schema Zod, leia o schema real do backend** (`backend/src/modules/<recurso>/schemas/<recurso>.schema.ts`) — campo, obrigatoriedade e enum do form aqui têm que espelhar `create<Nome>Schema`/`update<Nome>Schema` de lá. Se o backend ainda não existe (frontend sendo feito em paralelo), pergunte ao usuário o shape esperado em vez de inventar. Delegue a checagem de contrato pro agent `api-contract-reviewer` depois de escrever.

3. **`src/hooks/use-<recurso>.ts`** — um arquivo só, seguindo `use-companies.ts`:
   - `type <Recurso>` = shape de leitura (bate com `<Nome>Schema` de resposta do backend).
   - `<recurso>FormSchema` (Zod) com comentário `// Espelha create/update<Nome>Schema do backend` + `export type <Recurso>Form = z.infer<typeof <recurso>FormSchema>`.
   - Funções `fetch<Recurso>sRequest`/`create<Recurso>Request`/`update<Recurso>Request`/`delete<Recurso>Request` usando a instância `api` de `@/lib/api` — path e verbo batendo com `*.routes.ts` do backend.
   - `useQuery({ queryKey: ["<recurso>s", ...escopo], queryFn: fetch<Recurso>sRequest, enabled: ... })` — incluir todo parâmetro de escopo relevante (`companyId` etc.) na `queryKey`, senão o cache vaza entre empresas.
   - `useMutation` pra create/update/delete, `onSuccess: () => qc.invalidateQueries({ queryKey: [...] })`.
   - Funções expostas (`create<Recurso>`, `update<Recurso>`, `delete<Recurso>`) fazem `toast.loading → mutateAsync → toast.success/error` com `apiError(err, "Erro ao ...")`, retornam `Promise<boolean>` (create pode retornar a entidade/id).
   - Hook retorna objeto plano com `loading` (nunca `isLoading` cru), nunca tupla.

4. **`src/components/<Recurso>/<recurso>-table.tsx`** — componente apresentacional (`export function <Recurso>sTable(...)`), recebe dados + callbacks via props (`type Props = {...}`, nunca `interface`), usa `Table`/`TableRow`/etc de `@/components/ui/table`. Sem lógica de fetch/mutation dentro da tabela — isso é do hook/rota.

5. **`src/components/<Recurso>/<recurso>-form-dialog.tsx`** — `react-hook-form` + `zodResolver(<recurso>FormSchema)`. Se o dialog cobre create e edit, união discriminada nas props (ver `company-form-dialog.tsx`: `{ <recurso>: null; onCreate }` vs `{ <recurso>: X; onUpdate }`), duas instâncias de `useForm` trocadas por `isEdit`. Campos de UI vêm de `@/components/ui/*` já existente — checar antes de montar um controle na mão.

6. **`src/routes/dashboard/<recurso-plural>.tsx`** — rota simples (página + orquestração):
   ```tsx
   export const Route = createFileRoute("/dashboard/<recurso-plural>")({
       component: <Recurso>sPage,
   })

   function <Recurso>sPage() {
       const { <recurso>s, loading, create<Recurso>, update<Recurso>, delete<Recurso> } = use<Recurso>s()
       const [formOpen, setFormOpen] = useState(false)
       const [editing, setEditing] = useState<<Recurso> | null>(null)
       const [deleting, setDeleting] = useState<<Recurso> | null>(null)
       // <PageHeader/> + <Recurso>sTable + <Recurso>FormDialog + ConfirmDeleteDialog, mesmo padrão de companies.tsx
   }
   ```
   Se a listagem crescer, usar `usePagination` (`@/hooks/use-pagination`) como em `companies.tsx`, não paginar na mão.

7. **Se o recurso participa do "route destination" compartilhado** (pode ser destino de rota de chamada — Time Conditions, IVR, Announcements, etc no backend): checar se `src/components/RouteDestination/` já lista esse `type` como opção de destino; se o backend ganhou esse recurso agora, o componente de seleção de destino também precisa da entrada nova, senão ele nunca aparece como opção pro usuário escolher.

8. Ao terminar, rode o agent `component-reviewer` (convenção shadcn/hook/dialog) e `api-contract-reviewer` (schema batendo com o backend), depois `build-checker` (`pnpm exec tsc --noEmit`).

## Nunca

- Nunca escrever tipo de formulário à mão fora do `z.infer` do schema.
- Nunca duplicar um primitivo shadcn que já existe em `src/components/ui/` — baixar via `pnpm dlx shadcn@latest add <nome>` se faltar.
- Nunca fazer fetch direto num componente/rota (`useEffect`+`fetch`) — sempre via hook de recurso com TanStack Query.
