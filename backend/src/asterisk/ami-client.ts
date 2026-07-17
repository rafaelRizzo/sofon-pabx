import { validateEnv } from '../config/env'
import { logger } from '../utils/logger'

// Cliente AMI mínimo (Asterisk Manager Interface, texto puro sobre TCP) — usado no lugar de
// `Bun.spawn(['asterisk', '-rx', ...])` pra não depender do binário CLI do Asterisk estar instalado
// no mesmo host/container. Login -> Command -> Logoff, best-effort (nunca lança, só loga).
const CRLF = '\r\n'
const AMI_TIMEOUT_MS = 5000

export async function runAmiCommand(command: string): Promise<void> {
    const env = validateEnv()
    if (!env.AMI_SECRET) {
        logger.warn({ event: 'ami.command.skipped', reason: 'AMI_SECRET not configured', command })
        return
    }

    await new Promise<void>((resolve) => {
        let socket: Bun.Socket<undefined> | undefined
        let buffer = ''
        let loggedIn = false
        let settled = false

        const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            socket?.end()
            resolve()
        }

        const timeout = setTimeout(() => {
            logger.warn({ event: 'ami.command.timeout', command })
            finish()
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
                    buffer += data.toString('utf8')
                    if (loggedIn || !buffer.includes(CRLF + CRLF)) return
                    loggedIn = true
                    if (buffer.includes('Response: Error')) {
                        logger.warn({ event: 'ami.login.failed', command })
                    }
                    sock.write(`Action: Command${CRLF}Command: ${command}${CRLF}${CRLF}Action: Logoff${CRLF}${CRLF}`)
                    setTimeout(() => {
                        // warn (não info) de propósito: nível 'info' é descartado em produção
                        // (ver logger.ts) e essa é a única confirmação de que o reload rodou
                        logger.warn({ event: 'ami.command.executed', command })
                        finish()
                    }, 200)
                },
                error(_sock, error) {
                    logger.warn({ event: 'ami.command.failed', command, error: error.message })
                    finish()
                },
                close() {
                    finish()
                },
            },
        }).catch((error) => {
            logger.warn({ event: 'ami.connect.failed', command, error: error instanceof Error ? error.message : String(error) })
            finish()
        })
    })
}
