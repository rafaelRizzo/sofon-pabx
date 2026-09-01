---
name: new-module
description: Gera um módulo novo (routes/controller/service/cache/schema/tests) seguindo o padrão real deste backend. Use quando o usuário pedir um recurso/CRUD novo (ex: "cria um módulo de sms-templates").
---

# new-module

Gera os arquivos fixos de um módulo novo em `backend/src/modules/<nome>/`, seguindo exatamente o padrão de `src/modules/companies/` (use como referência literal de código, não invente sintaxe nova).

## Passo a passo

1. **Nome do recurso**: se o usuário não disse, pergunte. Diretório plural kebab-case (`sms-templates`), model Prisma singular PascalCase (`SmsTemplate`), tabela real via `@@map("sms_templates")`.

2. **Pergunte (ou infira do contexto) 4 coisas antes de escrever código**:
   - O recurso é escopado por `companyId` (like `Did`, `Extension`) ou é o próprio tenant raiz tipo `Company`? A maioria dos módulos novos segue o primeiro caso.
   - **O recurso participa do "route destination" compartilhado?** — ou seja, uma chamada pode terminar/passar por ele (como Time Conditions, IVR, Announcements, Variables). Se sim, ele precisa: (a) um campo `destination`/`trueRoute`/`falseRoute` usando o schema compartilhado (`src/schemas/route-destination.schema.ts`), (b) chamar `validateRouteDestination()` (`src/schemas/route-destination.validate.ts`) no create/update antes de persistir, e (c) um repositório Asterisk próprio em `src/asterisk/` que materialize o dialplan (estático via `dialplan-file.repository.ts`, seguindo o padrão de `timecondition.repository.ts`/`variable.repository.ts`) — **isso é o item mais fácil de esquecer e o que mais diferencia este projeto de um CRUD comum**, não pule essa pergunta.
   - Precisa de `cache/<nome>.cache.ts`? Padrão é sim (leitura cache-first via `CacheManager`, `src/config/cache.ts`). Só pula se for write-only ou ler dado sensível, documentando a exceção em comentário no service.
   - Quem pode gerenciar (`requirePermission('<recurso>', 'manage')`) e quem só lê (`'view'`)? Se o recurso for um recurso de negócio novo com tela própria no frontend, ele também entra em `PERMISSION_RESOURCES` (`src/utils/auth/permissions.ts`) — sem isso, `requirePermission` nunca vai reconhecer o nome do recurso.

3. **Model Prisma** em `backend/prisma/schema.prisma` (não gerar migration, isso é o skill `db-migrate`):
   ```prisma
   model SmsTemplate {
       id        String   @id @default(cuid())
       name      String
       companyId String
       company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
       createdAt DateTime @default(now()) @db.Timestamptz(3)
       updatedAt DateTime @updatedAt @db.Timestamptz(3)

       @@unique([name, companyId])
       @@index([companyId])
       @@map("sms_templates")
   }
   ```
   Adicionar a relação inversa (`smsTemplates SmsTemplate[]`) no `model Company`. Delegue a revisão do schema pro agent `db-schema-reviewer` antes de considerar essa etapa concluída.

4. **Audit log — adicionar o model novo em `AUDITED_MODELS`** (`src/lib/prisma.ts`): é uma extensão do Prisma que intercepta `create`/`update`/`upsert`/`delete`/`updateMany`/`deleteMany` de qualquer model listado nesse `Set` e grava automaticamente em `AuditLog` — **não é opt-in por módulo, é uma lista central**. Sem adicionar o nome do model novo (PascalCase, igual ao `model` do Prisma) nesse `Set`, toda escrita do módulo novo fica invisível no log de auditoria, sem erro nenhum avisando. Se o model tiver campo sensível (senha, token, secret), adicionar também em `REDACTED_FIELDS` (mesmo arquivo) pra não gravar o valor em claro no `before`/`after`. **Item fácil de esquecer porque nada quebra em dev/teste se você pular — só descobre depois, olhando o audit log e vendo o módulo novo ausente.**

5. **`schemas/<nome-singular>.schema.ts`** — um arquivo só, input e output juntos (diferente de projetos que separam em dois arquivos):
   - `idParamSchema` (`z.object({ id: z.cuid2() })`), `create<Nome>Schema`, `update<Nome>Schema` (todos campos opcionais, sem `.refine` de "mínimo 1 campo" salvo se o projeto pedir — ver `updateCompanySchema` como referência, não exige `.refine` aqui).
   - Tipos `Create<Nome>Input`/`Update<Nome>Input` via `z.infer`.
   - `<Nome>Schema` (formato de resposta) usando `timestamp` de `src/schemas/responses.ts` pros campos de data, e `ok({...})` (também de `responses.ts`) pra montar `List<Nome>sResponse`/`Get<Nome>Response`/`Create<Nome>Response`/`Update<Nome>Response`. Zod 4 sempre (`z.email()`, `z.cuid2()`).

6. **`cache/<nome>.cache.ts`** — classe estática com namespace próprio (`const NAMESPACE = '<recurso>'`), métodos `get<X>`/`set<X>`/`invalidate<X>` chamando `cacheManager.get/set/invalidateByKey` (`src/config/cache.ts`), logando `cache.hit`/`cache.miss`/`cache.set`/`cache.invalidate` via `logger.info` — ver `companies.cache.ts` como referência literal de formato de log e nomenclatura de chave (`<namespace>:<entidade>`, `<namespace>:list`, etc).

7. **`<nome>.service.ts`**: funções soltas exportadas (não classe), `prisma` do singleton `src/lib/prisma.ts`, cache-first em toda leitura, invalida cache em toda escrita, `AppError` (`src/utils/errors/app.error.ts`) pra erro de domínio, `prisma.$transaction` se mais de um write relacionado (ex: create + vínculo m2m). Se o módulo participa do route destination (passo 2), chamar `validateRouteDestination(destination, companyId)` antes do `prisma.create`/`update`.

8. **`<nome>.controller.ts`**: funções nomeadas (não arrow), try/catch + `handleError(reply, error, req)`, `.parse()` do schema de request antes de chamar o service, `req.scope.assertAccess(companyId)` antes de tocar o recurso (leitura de item único e toda escrita), `reply.send({ success: true, message: '<Mensagem em inglês, ver companies.controller>', <recurso>: resultado })` ou `reply.status(201).send(...)` no create.

9. **`<nome>.routes.ts`**: `router.get/post/put/delete` com `onRequest: [...protectedRoute, requirePermission('<recurso>', 'view'|'manage')]`, `schema.tags`, `schema.response` mapeando todo status code que o controller pode devolver usando `errors[<code>]`/`deleted` de `src/schemas/responses.ts`. Handler registrado com `as any` (padrão deste projeto pro type provider).

10. **Registrar o módulo em `src/app.ts`**: import da rota + `app.register(<nome>Routes)`.

11. **`__tests__/<nome>.service.test.ts`**: delegue pro agent `test-writer` em vez de escrever à mão, ele já segue o padrão de `createPrismaMock()`/`clearPrismaMock()`. **Módulo novo sem esse arquivo não está concluído.**

12. **`__tests__/<nome>.routes.test.ts`**: integration, `buildApp` de `src/test/build-app.ts`, no mínimo o caso 401 sem token — também delegável pro `test-writer`.

13. Ao terminar, rode `bun run test:unit` (via agent `test-runner`) e `bunx tsc --noEmit` (via agent `build-checker`) pra validar. Não rode `test:integration` a menos que o usuário peça.

## Nunca

- Nunca gerar/rodar migration sozinho — depois de editar `schema.prisma`, pare e oriente o usuário a rodar `bun run migrate` ele mesmo (skill `db-migrate`).
- Nunca esquecer o recurso novo em `PERMISSION_RESOURCES` se ele tiver `requirePermission` próprio — sem isso o TypeScript nem aceita o literal, mas se alguém contornar com `as any` a permissão nunca vai casar em runtime.
- Nunca esquecer o model novo em `AUDITED_MODELS` (`src/lib/prisma.ts`, passo 4) — sem isso as escritas do módulo novo não geram nenhuma linha de audit log, e ninguém percebe até precisar investigar algo e notar a ausência.
