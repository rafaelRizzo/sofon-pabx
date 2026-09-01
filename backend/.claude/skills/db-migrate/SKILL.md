---
name: db-migrate
description: Fluxo seguro de mudança de schema Prisma neste projeto (editar schema.prisma -> mostrar diff -> parar -> usuário roda a migration). Use sempre que houver mudança em backend/prisma/schema.prisma que precise ir pro banco.
---

# db-migrate

Regra fixa deste projeto (`backend/CLAUDE.md`, seção "Convenções"): **"Nunca editar `schema.prisma` e mandar rodar migration — orientar o usuário a rodar ele mesmo."** Diferente de um fluxo `generate`→revisão de SQL→`migrate`, aqui **Claude nunca roda nenhum comando `prisma migrate`/`prisma db push`/`prisma generate`**, nem `--create-only`. A única ação de Claude é editar o `schema.prisma`; aplicar a mudança no banco é sempre manual, do usuário.

## Passo a passo

1. Edite `backend/prisma/schema.prisma` com a mudança pedida. Se a mudança for revisada por dúvida de modelagem, invoque o agent `db-schema-reviewer` **antes** do próximo passo (índice, cascade, nullability, isolamento por `companyId`).

2. Mostre pro usuário exatamente o que mudou (`git diff backend/prisma/schema.prisma` se já estava versionado, ou releia o trecho editado). Aponte especificamente, se aplicável:
   - Coluna nova `NOT NULL` sem `@default` numa tabela que já tem linhas em produção (a migration do Prisma vai pedir um valor default interativamente ou falhar em modo não-interativo).
   - Remoção de campo/model (perda de dado).
   - Mudança de tipo de coluna (pode truncar/converter dado existente).

3. **Pare aqui.** Diga explicitamente ao usuário que ele precisa rodar `bun run migrate` (mapeia pra `prisma migrate dev`, gera **e** aplica a migration contra `DATABASE_URL` do `.env`) ele mesmo, no ambiente que ele escolher (local ou via SSH na VPS). Nunca rode esse comando no mesmo turno, mesmo que o pedido original tenha sido genérico ("migra o banco", "atualiza o schema e já aplica").

4. Se o usuário disser que já rodou e colar um erro, ajude a interpretar o erro (é leitura/diagnóstico, não execução) — mas a correção (reverter uma migration, editar o schema de novo) ainda segue o mesmo fluxo: editar, mostrar, parar, o usuário aplica.

## Se o usuário pedir pra você rodar `prisma migrate`/`prisma db push`/`prisma generate` mesmo assim

Recuse educadamente e explique a regra (edição de schema fica pronta, aplicação é sempre manual). Isso vale mesmo pra `prisma generate` sozinho (regenerar o client) se a intenção real por trás do pedido for "aplicar a mudança de schema" — nesse caso, oriente a rodar via `bun run generate` local. Só é aceitável Claude rodar `prisma generate` isolado quando é claramente só pra corrigir tipos desatualizados do client sem nenhuma mudança pendente de schema (ex: depois de um `bun install` que trocou a versão do Prisma) — nesse caso não há risco de tocar o banco.

## Nunca

- Nunca `prisma migrate deploy`/`prisma migrate dev`/`prisma db push`/`prisma migrate reset` rodado por Claude, em nenhum ambiente.
- Nunca gerar migration e aplicar em produção sem o usuário ter visto o diff do schema primeiro.
- Nunca usar `prisma db push` como atalho pra "resolver" divergência de schema — esse projeto versiona migration (`prisma migrate dev`), `db push` não deixa histórico.
