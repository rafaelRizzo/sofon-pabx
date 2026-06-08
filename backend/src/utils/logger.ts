import pino from 'pino'
import fs from 'node:fs'
import path from 'node:path'

const logDir = path.resolve('logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const isProd = process.env.NODE_ENV === 'production'
const logsEnabled = process.env.LOG_ENABLED !== 'false'

let currentLogFile = ''
let fileStream: any

const getLogFile = () => {
  const date = new Date().toISOString().split('T')[0]
  return path.join(logDir, `app-${date}.log`)
}

const createStream = () => {
  currentLogFile = getLogFile()
  return pino.destination({
    dest: currentLogFile,
    sync: false,
  })
}

fileStream = createStream()

// Rotação automática a cada dia
setInterval(() => {
  const newFile = getLogFile()
  if (newFile !== currentLogFile) {
    fileStream = createStream()
  }
}, 60000)

export const logger = pino(
  {
    level: !logsEnabled ? 'silent' : isProd ? 'warn' : 'info',
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    base: undefined,
  },
  isProd
    ? fileStream
    : pino.multistream([
        { stream: fileStream },
        {
          stream: pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: `SYS:dd/mm/yyyy HH:MM:ss`,
              ignore: 'pid,hostname',
            },
          }),
        },
      ])
)

export const createRequestLogger = (req: any) => {
  const meta = {
    reqId: req.id,
    method: req.method,
    url: req.url,
    path: req.url.split('?')[0],
    query: req.url.includes('?') ? req.url.split('?')[1] : undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  }

  return {
    info: (event: string, data?: any) =>
      logger.info({ ...meta, event, ...data }),

    warn: (event: string, data?: any) =>
      logger.warn({ ...meta, event, ...data }),

    error: (event: string, error: Error, data?: any) =>
      logger.error({
        ...meta,
        event,
        error: error.message,
        stack: error.stack,
        errorCode: (error as any).code,
        ...data,
      }),
  }
}
