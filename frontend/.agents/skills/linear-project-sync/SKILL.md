---
name: linear-project-sync
description: Sync a software project's Linear structure with the implemented code and Git history. Use when asked to audit project progress, create or update milestones and issues for existing modules, assign labels and owners, mark verified work Done, or publish a concise Linear status update.
---

# Linear Project Sync

## Overview

Keep Linear aligned with code evidence. Create one issue per tracked module and link it to its milestone so milestone progress remains meaningful.

## Workflow

1. Inspect source modules, routes, tests, Git commits, and worktree state. Use `rtk` for shell commands.
2. Read the Linear project, milestones, issues, team statuses, and labels before mutating anything.
3. Map each implemented module to one milestone and one issue. Reuse existing milestones and labels whenever possible.
4. Set every changed issue explicitly:
   - `project` and `milestone`
   - `assignee: "me"`, unless the user specifies someone else
   - exactly one area label: `backend`, `frontend`, `telephony`, `infra`, or equivalent
   - type label: `feature`, `refactor`, `bug`, or `chore`
   - status based only on evidence
5. Update the project status with completed work, verification results, and blockers.
6. Re-read the affected issues and milestones. Report created, updated, and unresolved items.

## Status rules

- Set `Done` only when the module exists and relevant checks pass, or when the user explicitly confirms completion.
- Set `In Progress` when code exists but validation is incomplete or the worktree is partial.
- Keep `Todo` when there is no implementation evidence.
- Do not mark a project complete solely because its current issues are done.

## Linear conventions

- Prefer the workspace labels `backend`, `frontend`, `feature`, `refactor`, `bug`, `chore`, `telephony`, `observability`, `security`, `performance`, and `infra`.
- Labels in the same Linear group are mutually exclusive. Apply exactly one `Área` label and one `Tipo` label; add `Trabalho` labels only when relevant.
- Avoid legacy or duplicate labels when an equivalent canonical label exists.
- Use a precise title such as `[Backend] Implementar módulo IVR`.
- Describe the delivered behavior and cite the verification command or commit when available.
- If a new milestone has no linked issue, create the matching issue in the same synchronization, otherwise its progress will remain `0%`.

## Verification

- Run the narrowest relevant checks. Record failures accurately, including environment-only failures.
- Confirm issue counts, state, assignee, labels, and milestone linkage after writes.
- Never erase labels or change ownership outside the issues in scope.
