---
name: crud-com-destino
description: Cria CRUD de recurso com campo(s) de "destino" (RouteDestinationField) e/ou vínculo m-n a outro recurso (multi-select), seguindo o padrão de Time Conditions / Inbound Routes
---

# CRUD com destino / vínculo m-n

Variante de `/novo-crud` para recursos que roteiam chamada (`destination`, `trueRoute`/`falseRoute`,
`postQueueDestination`, `onSuccess`/`onError` etc.) e/ou têm relação m-n com outro recurso
(ex: time-condition ↔ time-groups). Exemplos canônicos no código — ler antes de escrever:

- **Com 1 destino + relação simples (FK)**: `hooks/use-inbound-routes.ts` + `components/InboundRoutes/*`
- **Com 2 destinos + relação m-n (multi-select)**: `hooks/use-time-conditions.ts` + `components/TimeConditions/*`

## Passos

1. **Contrato primeiro** (igual `/novo-crud`): ler `../backend/src/modules/<recurso>/<recurso>.routes.ts` e `schemas/`.
   Prestar atenção especial a:
   - Quais campos são `routeDestinationSchema` (destino) — no schema do backend aparecem como `Json?` no Prisma e usam `routeDestSchema`/`routeDestinationSchema` importado de `route-destination.schema.ts`.
   - Se há campo de relação m-n tipo `groupIds`/`memberIds` (array de cuid2) — **conferir se ele existe só no `create` schema ou também no `update`**. Nos módulos existentes (time-conditions) o `update` não aceita reatribuir a relação — só `name`/destinos. Se for o caso, replicar a assimetria no form: bloquear edição da relação e mostrar como badges somente leitura.
   - Como a relação m-n vem na resposta: geralmente **envolta num wrapper** (`timeGroups: [{ timeGroup: { id, name } }]`), não array plano — extrair com `.map(x => x.wrapper)`.
   - Se o `POST` retorna o objeto completo ou só `{ <recurso>Id }` — se só o id, o hook deve chamar `fetch<Recurso>s()` de novo após criar (não dar `setState` otimista).

2. **Hook** `hooks/use-<recurso>.ts`:
   - Importar `routeDestinationSchema`/`RouteDestination`/`type` de `@/components/RouteDestination/route-destination-field` para cada campo de destino.
   - Se a relação m-n for assimétrica, criar dois schemas zod (`create<Recurso>FormSchema` com `groupIds`, `update<Recurso>FormSchema` sem).
   - `groupIds: z.array(z.string()).min(1, "Selecione ao menos um <relacionado>")` se o vínculo for obrigatório.
   - Resto do CRUD é o template padrão do `/novo-crud` (fetch/create/update/delete + toast + filtro).

3. **Multi-select da relação m-n**: criar `components/<Recurso>/<relacionado>s-combobox.tsx` no estilo de
   `components/TimeConditions/time-groups-combobox.tsx` — é uma **lista buscável** (`Combobox<Item, true>`
   com `multiple`), não um grid de checkboxes: o vínculo pode ter dezenas de opções e o usuário precisa
   filtrar por nome. Props `{ items, value: string[], onChange, className }`, convertendo `value` (ids) para
   os objetos completos via `.find` antes de passar pro combobox. Padrão de chips do base-ui:
   ```tsx
   const anchor = useComboboxAnchor()
   <Combobox<Item, true> multiple items={items} value={selected}
       itemToStringLabel={(i) => i.name} isItemEqualToValue={(a, b) => a.id === b.id}
       onValueChange={(next) => onChange(next.map((i) => i.id))}>
       <ComboboxChips ref={anchor} className={className}>
           {selected.map((i) => <ComboboxChip key={i.id}>{i.name}</ComboboxChip>)}
           <ComboboxChipsInput placeholder="Buscar..." />
       </ComboboxChips>
       <ComboboxContent anchor={anchor}>
           <ComboboxEmpty>{items.length === 0 ? "Nenhum X cadastrado para essa empresa" : "Nenhum resultado"}</ComboboxEmpty>
           <ComboboxList>{(i: Item) => <ComboboxItem key={i.id} value={i}>{i.name}</ComboboxItem>}</ComboboxList>
       </ComboboxContent>
   </Combobox>
   ```
   `ComboboxChip` já inclui o botão de remover (`showRemove` default true) — não precisa `ComboboxChipRemove`
   manual. O `anchor` (de `useComboboxAnchor()`) liga o popup à largura do container de chips, não do input.
   Cuidado: `className` vai no `ComboboxChips`, não no `Combobox` raiz (raiz não renderiza elemento próprio).

4. **Empresa é campo do dialog, não do filtro da página**: como `companyId` é create-only no backend (ver
   passo 1), o dialog de criação/edição **gerencia sua própria empresa**, independente do `Combobox` de
   empresa que filtra a tabela na página — não passar `companyId` como prop vindo da página. Ordem dos campos
   no form: **Nome → Empresa → resto** (relação m-n, destinos etc.). Ver `time-condition-form-dialog.tsx` e
   `time-group-form-dialog.tsx`:
   - `useForm` com `companyId: ""` no `defaultValues`; `watch("companyId")` pra saber a empresa atual do form.
   - Modo criação: `<Combobox<Company>>` normal (mesmo padrão do combobox de empresa da página).
   - Modo edição: **campo nem aparece** (`{!isEdit && <Field>...</Field>}`) — como não dá pra mover o
     registro de empresa via PUT, mostrar um input desabilitado só adiciona ruído sem utilidade.
   - Qualquer hook que dependa da empresa pra popular opções (ex: `useTimeGroups(companyId)` pro multi-select,
     `fetchDestinationOptions` dentro do `RouteDestinationField`) usa o `companyId` **do form**, chamado
     dentro do próprio componente de dialog — não recebido via prop da página.
   - Campos que dependem de empresa (relação m-n, destinos) ficam escondidos/com texto
     "Selecione uma empresa primeiro" enquanto `companyId` do form estiver vazio.
   - Ao trocar de empresa no modo criação, resetar os campos dependentes (`groupIds: []`,
     destinos pra `{ type: "hangup" }`) — evita mandar IDs de uma empresa presos num form que agora aponta
     pra outra.
   - Botão "Novo/Nova X" da página **não** fica mais `disabled={!companyId}` — criar não depende da empresa
     que está sendo filtrada na tabela.

5. **Form dialog** `components/<Recurso>/<recurso>-form-dialog.tsx`:
   - Um `<RouteDestinationField value={...} onChange={...} companyId={companyId} />` (o `companyId` do form,
     passo 4) por campo de destino, com `FieldLabel` + `FieldDescription` explicando pra que serve cada um
     (ex: "dentro"/"fora do horário", "sucesso"/"erro").
   - `defaultValues` do destino: `{ type: "hangup" }`.
   - Se a relação m-n for create-only: no modo edição, renderizar os vinculados como `Badge` somente leitura
     + `FieldDescription` avisando que só é definido na criação; no modo criação, renderizar o combobox
     multi-select (passo 3) ligado a `groupIds` via `setValue(..., { shouldValidate: true, shouldDirty: true })`.
   - Resto (useForm + zodResolver, AlertDialog de descartar alterações, DialogFooter) é o esqueleto padrão —
     copiar de `time-condition-form-dialog.tsx` ou `inbound-route-form-dialog.tsx`.

6. **Tabela** `components/<Recurso>/<recurso>s-table.tsx`:
   - Reusar o padrão `useDestinationLabels` (hook local no arquivo da tabela) que agrupa por tipo de destino
     presente nas linhas visíveis e chama `fetchDestinationOptions(type, companyId)` **uma vez por tipo**, não
     por linha/campo — copiar de `time-conditions-table.tsx` (adaptar pra 1 ou N campos de destino por linha).
   - `DestinationBadge`/`DestinationCell`: `Badge` com ícone (`ROUTE_DEST_ICONS[type]`) + label
     (`ROUTE_DEST_LABELS[type]`) + nome resolvido (ou "…" enquanto carrega, ou "registro não encontrado" se
     sumiu).
   - Coluna da relação m-n: `Badge` por item vinculado (vem pronto na resposta, não precisa resolver).

7. **Página** `app/dashboard/<recurso>/page.tsx`: esqueleto igual `/novo-crud` (empresa via `Combobox` +
   `useEffect` seleciona a primeira, filtro texto, `usePagination`, dialogs de create/edit/delete). O
   `companyId` da página só serve pra **filtrar a tabela** — passar `companies` (lista completa) pro dialog,
   não `companyId`/`timeGroups` já resolvidos (ver passo 4).

7. `pnpm typecheck` ao final (não rodar lint — ver preferência do usuário).

## Peças reutilizáveis (não recriar)

- `components/RouteDestination/route-destination-field.tsx` — fonte de verdade de `RouteDestination`,
  `ROUTE_DEST_TYPES/LABELS/ICONS`, `fetchDestinationOptions`, e o campo `<RouteDestinationField>` em si.
- Tudo listado em `components/page-header.tsx`, `components/confirm-delete-dialog.tsx`,
  `components/data-pagination.tsx` + `hooks/use-pagination.ts` (ver `/novo-crud`).

## Erros comuns a evitar

- Inventar que a relação m-n é editável via PUT sem checar o schema do backend — a maioria só aceita no create.
- Esquecer o wrapper da relação na resposta (`{ timeGroup: {...} }` em vez de `{...}` direto).
- Resolver o destino com um `fetch` por linha da tabela em vez de agrupar por tipo (gera N+1 requests).
- Usar checkboxes soltos pra relação m-n em vez do combobox multi-select com busca (lista pode crescer, e o
  usuário precisa filtrar por nome — ver `time-groups-combobox.tsx`).
