# Frontend — Sofon PABX

Painel web do PABX. Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn (base-ui). Monorepo: backend Fastify em `../backend` (consultável).

## Comandos

- `pnpm dev` / `pnpm build`
- `pnpm lint` / `pnpm typecheck` / `pnpm format` — rodar só ao finalizar pedidos maiores (feature/refactor), não a cada micro-edição

## Estrutura

- `app/` — rotas (App Router). Páginas de dashboard em `app/dashboard/<recurso>/page.tsx`
- `hooks/` — **na raiz do frontend, NUNCA em `app/hooks/`**. Um hook por recurso da API com o CRUD completo (`hooks/use-extensions.ts` → `useExtensions`)
- `components/ui/` — shadcn via CLI (`pnpm dlx shadcn@latest add <x>`), não editar manualmente
- `components/<Feature>/` — componentes compostos por feature (ex: `components/Users/user-form-dialog.tsx`, `users-table.tsx`)
- `components/` (raiz) — genéricos compartilhados: `page-header.tsx`, `confirm-delete-dialog.tsx`, `status-badge.tsx` — reutilizar nos CRUDs, não recriar
- `lib/api.ts` — instância axios única. **Toda chamada à API passa por ela** (nunca `axios` direto nem `fetch`): request interceptor injeta `Authorization: Bearer` do cookie `token`; response interceptor faz refresh automático em 401 e redireciona para `/login` se falhar
- `proxy.ts` (raiz) — proteção de rotas via cookie `token` (Next 16: substitui `middleware.ts`)

## Convenções

- Indentação: **4 espaços** (tabWidth do Prettier) — escrever código novo já com 4
- Server Components por padrão; `"use client"` só onde há estado/efeito (hooks de CRUD são client)
- Arquivos kebab-case; hooks `use-<recurso>.ts` exportando `use<Recurso>`
- Tipos do recurso definidos e exportados no próprio arquivo do hook
- Toasts: `sonner` (é o toast oficial do shadcn) com padrão `toast.loading` → `toast.success/error({ id })`
- Classes: `cn()` de `lib/utils`; ícones: `lucide-react`; tema: `next-themes`

## API (backend `../backend`)

- Base URL: `NEXT_PUBLIC_API_URL` (dev: `http://localhost:3333`); rotas na raiz: `/extensions`, `/queues`, `/trunks`, `/dids`, `/companies`, `/users`, `/ivr`, `/cdr`, `/audios`, `/announcements`, `/inbound-routes`, `/outbound-routes`, `/time-groups`, `/time-conditions`, `/holiday-groups`, `/queue-members`, `/request-templates`
- **Contrato: antes de criar/alterar um hook, ler `../backend/src/modules/<recurso>/<recurso>.routes.ts` e `schemas/` — nunca inventar shape**
- Sucesso: `{ success: true, message, <recurso> }` (lista no plural, item no singular); erro: `{ success: false, message }` — extrair com `apiError()` de `lib/api.ts`
- Auth: `POST /auth/login` → `{ token }` (JWT, salvar no cookie `token`, js-readable) + `refreshToken` httpOnly setado pelo backend; `POST /auth/refresh` renova; `POST /auth/logout` revoga

## Novo CRUD

Usar a skill `/novo-crud` (template completo de hook + página). Se já existir hook de outro recurso, seguir o padrão dele.

## Next 16

Breaking changes vs training data — na dúvida, ler `node_modules/next/dist/docs/`.
