import { validateEnv } from '../../config/env'
import { logger } from '../../utils/logger'

// Cliente AMI mínimo (Asterisk Manager Interface, texto puro sobre TCP) - usado no lugar de
// `Bun.spawn(['asterisk', '-rx', ...])` pra não depender do binário CLI do Asterisk estar instalado
// no mesmo host/container. Login -> Command -> Logoff, best-effort (nunca lança, só loga).
const CRLF = '\r\n'
const AMI_TIMEOUT_MS = 5000

// Serializa execuções: cada regenerate() dispara seu próprio reloadDialplan() (fire-and-forget,
// debounced) e o resync explícito (reloadDialplanNow) soma mais uma chamada em cima - sem fila,
// isso abre várias conexões/logins concorrentes na mesma sessão do Manager, e uma delas pode ser
// fechada/rejeitada pelo Asterisk enquanto a outra ainda está processando (falso negativo: reload
// funciona mas a chamada que a API estava esperando volta false). Rodando uma de cada vez, a
// chamada explícita simplesmente espera a fila esvaziar em vez de competir por uma conexão nova.
let queue: Promise<unknown> = Promise.resolve()

// Retorna se o comando de fato foi enviado e confirmado (data handler chegou ao fim do fluxo
// feliz) - chamadores fire-and-forget (reloadDialplan) seguem ignorando o retorno; chamadores que
// precisam saber se o reload realmente aconteceu (reloadDialplanNow) usam esse boolean.
export function runAmiCommand(command: string): Promise<boolean> {
    const run = queue.then(() => runAmiCommandNow(command))
    queue = run.catch(() => undefined)
    return run
}

function runAmiCommandNow(command: string): Promise<boolean> {
    const env = validateEnv()
    if (!env.AMI_SECRET) {
        logger.warn({ event: 'ami.command.skipped', reason: 'AMI_SECRET not configured', command })
        return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
        let socket: Bun.Socket<undefined> | undefined
        let buffer = ''
        let loggedIn = false
        let commandSent = false
        let settled = false

        const finish = (success: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            socket?.end()
            resolve(success)
        }

        const timeout = setTimeout(() => {
            logger.warn({ event: 'ami.command.timeout', command })
            finish(false)
        }, AMI_TIMEOUT_MS)

        Bun.connect({
            hostname: env.AMI_HOST,
            port: env.AMI_PORT,
            socket: {
                open(sock) {
                    socket = sock
                    sock.write(`Action: Login${CRLF}Username: ${env.AMI_USER}${CRLF}Secret: ${env.AMI_SECRET}${CRLF}${CRLF}`)
                },
                data(sock, data) {
                    if (settled) return
                    buffer += data.toString('utf8')
                    if (loggedIn || !buffer.includes(CRLF + CRLF)) return
                    loggedIn = true
                    if (buffer.includes('Response: Error')) {
                        logger.warn({ event: 'ami.login.failed', command })
                        finish(false)
                        return
                    }
                    // Command + Logoff na mesma escrita: o Asterisk processa os dois e fecha a
                    // conexão sozinho (às vezes antes de terminar de streamar a resposta do
                    // Command) - isso é o fluxo normal do Logoff que a gente pediu, não uma falha.
                    // `commandSent` marca esse ponto pra o close() saber diferenciar "fechou porque
                    // completou o que pedimos" de "fechou/caiu antes de sequer receber o comando".
                    commandSent = true
                    sock.write(`Action: Command${CRLF}Command: ${command}${CRLF}${CRLF}Action: Logoff${CRLF}${CRLF}`)
                },
                error(_sock, error) {
                    logger.warn({ event: 'ami.command.failed', command, error: error.message })
                    finish(false)
                },
                close() {
                    if (commandSent) {
                        // warn (não info) de propósito: nível 'info' é descartado em produção
                        // (ver logger.ts) e essa é a única confirmação de que o reload rodou
                        logger.warn({ event: 'ami.command.executed', command })
                        finish(true)
                    } else {
                        if (!settled) logger.warn({ event: 'ami.command.closed', command })
                        finish(false)
                    }
                },
            },
        }).catch((error) => {
            logger.warn({ event: 'ami.connect.failed', command, error: error instanceof Error ? error.message : String(error) })
            finish(false)
        })
    })
}
