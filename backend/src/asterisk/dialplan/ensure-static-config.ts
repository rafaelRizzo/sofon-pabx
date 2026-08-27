import { ensureBaseDialplan } from './base-dialplan.repository'
import { bumpTransferDigitTimeout } from './features.repository'
import { runAmiCommand } from '../transport/ami-client'
import { logger } from '../../utils/logger'

export type StaticAsteriskConfigResult = {
    baseDialplanRewritten: boolean
    dialplanReloadApplied: boolean
    transferDigitTimeoutBumped: boolean
    restartRequired: boolean
}

// Autocura da config estática global do Asterisk (fora do escopo por-empresa de
// dialplan-file.repository.ts) sem depender de um admin chamar resyncDialplan manualmente -
// chamado no boot do backend (server.ts) e reusado por resyncDialplan. Cada etapa é isolada:
// uma falha de reload não impede a próxima etapa nem derruba o boot, só fica logada como warn -
// quem precisa de garantia forte (resyncDialplan) lê o resultado e decide se lança erro.
//
// Propositalmente NÃO inclui removeBlindTransferFeature() (features.repository.ts) - migração
// ainda sem decisão sobre o substituto do #1 global, continua só no fluxo manual de resyncDialplan.
export async function ensureStaticAsteriskConfig(): Promise<StaticAsteriskConfigResult> {
    const result: StaticAsteriskConfigResult = {
        baseDialplanRewritten: false,
        dialplanReloadApplied: false,
        transferDigitTimeoutBumped: false,
        restartRequired: false,
    }

    try {
        result.baseDialplanRewritten = await ensureBaseDialplan()
        if (result.baseDialplanRewritten) {
            result.dialplanReloadApplied = await runAmiCommand('dialplan reload')
            if (!result.dialplanReloadApplied) {
                logger.warn({ event: 'asterisk.static_config.dialplan_reload_failed' })
            }
        }
    } catch (error) {
        logger.warn({
            event: 'asterisk.static_config.base_dialplan_failed',
            error: error instanceof Error ? error.message : String(error),
        })
    }

    try {
        // features.conf não recarrega a quente nessa versão do Asterisk - nem "module reload
        // features.so" (retorna sucesso mas não aplica) nem "core reload" pegam o featuremap/
        // general em memória, só um "systemctl restart asterisk" completo (descoberto debugando
        // *2/atxfer não funcionar mesmo com o arquivo correto). Não tem AMI action pra restart de
        // processo - só reporta que precisa de restart manual, nunca finge reload bem-sucedido.
        result.transferDigitTimeoutBumped = await bumpTransferDigitTimeout()
        if (result.transferDigitTimeoutBumped) {
            result.restartRequired = true
            logger.warn({ event: 'asterisk.static_config.restart_required', file: 'features.conf' })
        }
    } catch (error) {
        logger.warn({
            event: 'asterisk.static_config.transfer_digit_timeout_failed',
            error: error instanceof Error ? error.message : String(error),
        })
    }

    logger.info({ event: 'asterisk.static_config.ensured', ...result })
    return result
}
