---
name: linear-project-sync
description: Sync only the Sofon PABX Linear project with the implemented code and Git history. Use when asked to audit its progress, create or update its milestones and issues, assign labels and owners, mark verified work Done, or publish a concise project status update.
---

# Linear Project Sync

## Fixed scope

Operate exclusively in this Linear scope:

- Project: `Sofon PABX` (`fd073761-3d48-49c6-8d01-35e8f0691cbd`)
- Team: `Developer` (`a7246231-d17e-4f73-8ca3-451e5f0a72a5`, key `PHO`)
- Lead and default assignee: Rafael (`16015efe-8a09-4bc2-985f-cd7ef7253aa8`)

Never create, move, update, label, assign, comment on, or change milestones for another Linear project, team, or initiative. If the request targets a different scope, report that this skill is restricted to Sofon PABX and do not mutate Linear.

Keep Sofon PABX aligned with code evidence. Create one issue per tracked module and link it to its milestone so milestone progress remains meaningful.

## Workflow

1. Inspect source modules, routes, tests, Git commits, and worktree state. Use `rtk` for shell commands.
2. Read the fixed Linear project, its milestones, issues, team statuses, and labels before mutating anything. Confirm the returned project ID matches the fixed scope.
3. Set the fixed `project` and `team` IDs on every created issue. Map each implemented module to one milestone and one issue. Reuse existing milestones and labels whenever possible.
4. Set every changed issue explicitly:
   - fixed `project`, `team`, and `milestone`
   - `assignee: Rafael`, unless the user specifies another Sofon PABX team member
   - exactly one existing `Área` label
   - exactly one existing `Tipo` label
   - status based only on evidence
5. Update the project status with completed work, verification results, and blockers.
6. Re-read the affected issues and milestones. Confirm each changed issue remains in Sofon PABX and report created, updated, and unresolved items.

## Status rules

- Set `Done` only when the module exists and relevant checks pass, or when the user explicitly confirms completion.
- Set `In Progress` when code exists but validation is incomplete or the worktree is partial.
- Keep `Todo` when there is no implementation evidence.
- Do not mark a project complete solely because its current issues are done.

## Linear conventions

- Use only existing team labels. Labels in the same Linear group are mutually exclusive. Apply exactly one `Área` label and one `Tipo` label, then one `Tema` label only when relevant.
- Avoid legacy or duplicate labels when an equivalent canonical label exists.
- Use a precise title such as `[Backend] Implementar módulo IVR`.
- Describe the delivered behavior and cite the verification command or commit when available.
- If a new milestone has no linked issue, create the matching issue in the same synchronization, otherwise its progress will remain `0%`.

## Verification

- Run the narrowest relevant checks. Record failures accurately, including environment-only failures.
- Confirm issue counts, state, assignee, labels, and milestone linkage after writes.
- Never erase labels or change ownership outside the issues in scope.
