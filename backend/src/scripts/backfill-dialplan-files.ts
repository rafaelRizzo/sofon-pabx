// One-off: gera os arquivos estáticos de dialplan (/etc/asterisk/dialplan-extra/**) pra todas as
// empresas já existentes no banco — necessário depois do deploy que trocou holidays/timeconditions/
// announcements/ivrs/queues-app/request-templates de Realtime pra arquivo, já que `regenerate()` só
// roda automaticamente em create/update/delete daqui pra frente. Rodar uma vez no VPS:
//   bun run src/scripts/backfill-dialplan-files.ts
import { prisma } from '../lib/prisma'
import { HolidayGroupRepository } from '../asterisk/holidaygroup.repository'
import { TimeConditionRepository } from '../asterisk/timecondition.repository'
import { AnnouncementRepository } from '../asterisk/announcement.repository'
import { IvrRepository } from '../asterisk/ivr.repository'
import { AsteriskQueueRepository } from '../asterisk/queue.repository'
import { RequestTemplateRepository } from '../asterisk/request-template.repository'

async function main() {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } })
    console.log(`Backfill de dialplan estático — ${companies.length} empresa(s)`)

    for (const company of companies) {
        console.log(`→ ${company.name} (${company.id})`)
        await HolidayGroupRepository.regenerate(company.id)
        await TimeConditionRepository.regenerate(company.id)
        await AnnouncementRepository.regenerate(company.id)
        await IvrRepository.regenerate(company.id)
        await AsteriskQueueRepository.regenerate(company.id)
        await RequestTemplateRepository.regenerate(company.id)
    }

    console.log('Backfill concluído.')
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => process.exit(0))
