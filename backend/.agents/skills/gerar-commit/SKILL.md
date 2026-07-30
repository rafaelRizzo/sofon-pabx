---
description: Gera mensagem de commit semântico (conventional commits) com base nas mudanças staged/unstaged do git
---

Analise as mudanças do repositório atual:

Mudanças staged:
!`git diff --staged 2>/dev/null || echo "(nenhuma)"`

Mudanças não staged:
!`git diff 2>/dev/null | head -200 || echo "(nenhuma)"`

Status:
!`git status --short 2>/dev/null || echo "(nenhum)"`

Antes de gerar a mensagem, verifique se já está estabelecido na conversa (ou em CLAUDE.md/config do repo) se este projeto é um **monorepo** (frontend + backend no mesmo repositório, ex: pastas `front/`+`back/`, `apps/web`+`apps/api`, etc). Se não estiver claro, pergunte ao usuário com a ferramenta AskUserQuestion antes de prosseguir (pergunta: "Este repositório é monorepo (front + back juntos)?", opções "Sim" / "Não").

- Se **for monorepo**: use o formato completo abaixo, com escopo `(front|back|full)` no título e sufixo `(front|back)` em cada bullet.
- Se **não for monorepo**: omita o escopo do título (apenas `<tipo>: <descrição>`) e omita o sufixo `(front|back)` dos bullets.

Com base nas mudanças acima, gere uma mensagem de commit seguindo **Conventional Commits**:

## Tipos permitidos

| Tipo | Quando usar |
|------|------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Manutenção, dependências, config |
| `docs` | Documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `style` | Formatação, lint, sem lógica |
| `ui` | Mudanças visuais/interface |
| `test` | Testes |
| `perf` | Performance |
| `ci` | CI/CD, pipelines |
| `build` | Build system, scripts |
| `revert` | Reversão de commit anterior |

## Formato de saída

Monorepo:
```
<tipo>(<escopo>): <descrição curta em português>

- <o que mudou 1> (front|back)
- <o que mudou 2> (front|back)
- <o que mudou 3> (front|back)
```

Repositório único (não monorepo):
```
<tipo>: <descrição curta em português>

- <o que mudou 1>
- <o que mudou 2>
- <o que mudou 3>
```

## Escopo (obrigatório no título, apenas se monorepo)

- `(front)` — mudanças só no frontend
- `(back)` — mudanças só no backend
- `(full)` — mudanças em frontend e backend

## Regras

- Descrição curta: particípio passado (ex: "Redesenhado X", "Corrigido Y", "Adicionado Z"), sem ponto final, máx 72 chars
- Bullets: imperativo no particípio passado (ex: "Adicionado X", "Corrigido Y", "Removido Z", "Atualizado W")
- Se monorepo, cada bullet termina com `(front)` ou `(back)` indicando onde a mudança ocorreu; se não for monorepo, não adicione esse sufixo
- Bullets: ordenados do mais importante ao menos importante
- Se houver múltiplos tipos, use o dominante e liste os demais nos bullets
- Português no body, tipo em inglês
- Nunca invente mudanças que não estejam no diff

Apresente apenas a mensagem final, sem explicações adicionais.

**Não execute o commit.** Apenas exiba a mensagem sugerida para que o usuário faça o commit manualmente.
