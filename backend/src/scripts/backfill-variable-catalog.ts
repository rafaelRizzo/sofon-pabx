// One-off: popula o Catálogo de Variáveis (model Variable) a partir dos nomes já em uso hoje em
// IvrMenu.variableName e VariableSet.assignments[].variable - sem isso, toda URA/Definir Variável
// existente falha a validação assertVariableExistsForCompany() na primeira edição depois do
// deploy (o dialplan já gerado continua funcionando, só o formulário não deixa salvar de novo até
// a variável existir no catálogo). Idempotente - roda quantas vezes precisar. Rodar uma vez no VPS:
//   bun run src/scripts/backfill-variable-catalog.ts
import { prisma } from '../lib/prisma'
import { VARIABLE_NAME_REGEX } from '../schemas/variable-name.schema'
import type { Assignment } from '../modules/variables/schemas/variable.schema'

async function main() {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } })
    console.log(`Backfill do Catálogo de Variáveis - ${companies.length} empresa(s)`)

    for (const company of companies) {
        const [ivrMenus, variableSets] = await Promise.all([
            prisma.ivrMenu.findMany({ where: { companyId: company.id, variableName: { not: null } }, select: { variableName: true } }),
            prisma.variableSet.findMany({ where: { companyId: company.id }, select: { assignments: true } }),
        ])

        const names = new Set<string>()
        for (const m of ivrMenus) if (m.variableName) names.add(m.variableName)
        for (const s of variableSets) for (const a of s.assignments as Assignment[]) names.add(a.variable)

        const validNames = [...names].filter((n) => {
            const ok = VARIABLE_NAME_REGEX.test(n)
            if (!ok) console.warn(`  ! ignorando nome inválido "${n}" (${company.name})`)
            return ok
        })
        if (validNames.length === 0) continue

        const { count } = await prisma.variable.createMany({
            data: validNames.map((name) => ({ name, companyId: company.id })),
            skipDuplicates: true,
        })
        if (count > 0) console.log(`→ ${company.name} (${company.id}): ${count} variável(is) criada(s)`)
    }

    console.log('Backfill concluído.')
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => process.exit(0))
