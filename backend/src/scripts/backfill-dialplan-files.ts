// Gera os arquivos estáticos de dialplan (/etc/asterisk/dialplan-extra/**) pra todas as empresas
// já existentes no banco. Roda sozinho em todo restart do container (entrypoint.sh, junto com
// `prisma migrate deploy`, só em PROCESS_ROLE != web) - é a "migration" genérica pra qualquer
// bug/ajuste no *gerador* de dialplan (buildDialplan/regenerate de qualquer repository) que não
// mexe em schema: o fix só se reflete nas chamadas novas até esse script rodar e reescrever os
// .conf já materializados com o template antigo. Autocura também depois de reinstalação do
// Asterisk que apagou dialplan-extra/ mas manteve o banco intacto.
// Rodar manualmente (ex: local contra .env apontando pro banco certo, sem esperar o próximo restart):
//   bun run src/scripts/backfill-dialplan-files.ts
import { prisma } from '../lib/prisma'
import { HolidayGroupRepository } from '../asterisk/destinations/holidaygroup.repository'
import { TimeConditionRepository } from '../asterisk/destinations/timecondition.repository'
import { AnnouncementRepository } from '../asterisk/destinations/announcement.repository'
import { IvrRepository } from '../asterisk/destinations/ivr.repository'
import { AsteriskQueueRepository } from '../asterisk/destinations/queue.repository'
import { RequestTemplateRepository } from '../asterisk/destinations/request-template.repository'
import { VariableRepository } from '../asterisk/destinations/variable.repository'
import { VariableConditionRepository } from '../asterisk/destinations/variablecondition.repository'
import { CallcenterSurveyRepository } from '../asterisk/destinations/callcenter-survey.repository'
import { FormatterNodeRepository } from '../asterisk/destinations/formatter-node.repository'
import { IxcNodeRepository } from '../asterisk/destinations/ixc-node.repository'
import { FlowRepository } from '../asterisk/flows/flow.repository'
import { FlowNodeRepository } from '../asterisk/flows/flow-node.repository'
import { reloadDialplanNow } from '../asterisk/dialplan/dialplan-file.repository'

async function main() {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } })
    console.log(`Backfill de dialplan estático - ${companies.length} empresa(s)`)

    for (const company of companies) {
        console.log(`→ ${company.name} (${company.id})`)
        await HolidayGroupRepository.regenerate(company.id)
        await TimeConditionRepository.regenerate(company.id)
        await AnnouncementRepository.regenerate(company.id)
        await IvrRepository.regenerate(company.id) // já regenera flow-nodes internamente (IVRs por instância)
        await AsteriskQueueRepository.regenerate(company.id) // já regenera flow-nodes internamente
        await RequestTemplateRepository.regenerate(company.id)
        await VariableRepository.regenerate(company.id)
        await VariableConditionRepository.regenerate(company.id)
        await CallcenterSurveyRepository.regenerate(company.id)
        await FormatterNodeRepository.regenerate(company.id)
        await IxcNodeRepository.regenerate(company.id)
        await FlowRepository.regenerate(company.id)
        await FlowNodeRepository.regenerate(company.id) // idempotente mesmo já rodado via Ivr/Queue acima
    }

    // regenerate() só dispara reloadDialplan() fire-and-forget (debounced 500ms) - sem isso o
    // `process.exit(0)` abaixo mata o processo antes do debounce/AMI completarem, e os .conf saem
    // corretos no disco mas o Asterisk continua servindo o dialplan antigo em memória até alguém
    // rodar reload manual ou editar algo pela API de novo (ver docs/runbooks/dialplan-reload-race.md)
    const reloaded = await reloadDialplanNow()
    console.log(`Backfill concluído. Dialplan reload via AMI: ${reloaded ? 'ok' : 'falhou (ver logs de warn ami.*)'}`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => process.exit(0))
