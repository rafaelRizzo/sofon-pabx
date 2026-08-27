import { z } from 'zod'

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    // Controla o que esse processo sobe: 'web' (só API HTTP, escalável em N réplicas), 'worker'
    // (AGI + AMI events + cron jobs, sempre 1 instância só) ou 'all' (tudo junto, default -
    // preserva o comportamento de sempre em dev local/single-instance)
    PROCESS_ROLE: z.enum(['web', 'worker', 'all']).default('all'),
    PORT: z.coerce.number().default(3333),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().default('your-secret-key-change-in-production'),
    REFRESH_SECRET: z.string().default('your-refresh-secret-change-in-production'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z.string().default('http://localhost:3333'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    LOG_ENABLED: z.coerce.boolean().default(true),
    API_BASE_URL: z.string().default('http://localhost:3333'),
    API_TIMEOUT: z.coerce.number().default(10000),
    RATE_LIMIT_MAX: z.coerce.number().default(1000),
    RATE_LIMIT_WINDOW: z.string().default('1 second'),
    AUDIO_UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
    AUDIO_UPLOAD_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
    AUDIO_CONVERSION_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
    AUDIO_CONVERSION_QUEUE_MAX: z.coerce.number().int().min(0).max(100).default(10),
    AUDIO_CONVERSION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    DATABASE_POOL_SIZE: z.coerce.number().default(10),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    TZ: z.string().default('America/Sao_Paulo'),
    // FastAGI server (src/asterisk/agi-server.ts) - host/porta que o Asterisk usa pra conectar via
    // AGI(agi://AGI_HOST:AGI_PORT/run,<requestTemplateId>) ao executar um RouteDestination type: "request"
    AGI_HOST: z.string().default('127.0.0.1'),
    AGI_PORT: z.coerce.number().default(4573),
    // AMI (Asterisk Manager Interface, src/asterisk/ami-client.ts) - usado pra mandar comandos tipo
    // "dialplan reload" sem depender do binário CLI do Asterisk instalado no host/container do backend.
    // setups/install-asterisk.sh já habilita manager.conf com esse host/porta/usuário por padrão; o
    // secret é gerado por instalação e precisa ser copiado manualmente pro .env (AMI_SECRET indefinido
    // = reload via AMI é pulado, só loga warning, nunca derruba a request).
    AMI_HOST: z.string().default('127.0.0.1'),
    AMI_PORT: z.coerce.number().default(5038),
    AMI_USER: z.string().default('admin'),
    AMI_SECRET: z.string().optional(),
    // Diagnóstico do ami-events.ts: loga cada bloco cru (Event/Response + todos os campos) via
    // logger.warn (visível mesmo em produção, onde o nível default é 'warn') - usado pra confirmar
    // nomes de campo reais contra a versão de Asterisk instalada quando o mapeamento não bate.
    // Fica bem verboso (DeviceStateChange dispara muito) - ligar só durante uma investigação pontual.
    AMI_DEBUG: z.coerce.boolean().default(false),
    // Diretório onde dialplan-file.repository.ts materializa os contextos estáticos (timeconditions,
    // announcements, ivrs, holidays, queues-app, request-templates). Default é o caminho real do
    // Asterisk - testes de integração sobrescrevem via .env.test pra um dir gravável sem Asterisk instalado.
    DIALPLAN_EXTRA_DIR: z.string().default('/etc/asterisk/dialplan-extra'),
    // Diretório de config do Asterisk onde base-dialplan.repository.ts materializa sofon-managed.conf
    // (esqueleto global: ramais/transfer/from-trunk/from-trunk-routed + #tryinclude, ver instalador) -
    // testes de integração sobrescrevem via .env.test pro mesmo dir gravável do DIALPLAN_EXTRA_DIR.
    ASTERISK_CONF_DIR: z.string().default('/etc/asterisk'),
    // Espelham a escolha feita em setups/install-asterisk.sh (versão do Asterisk define as portas
    // SIP/PJSIP) - o instalador grava esses valores no .env do backend. Expostos via GET /system/sip-config
    // pro frontend exibir a configuração correta (ex: instruções de provisionamento de ramal).
    ASTERISK_VERSION: z.string().optional(),
    SIP_LEGACY_ENABLED: z.coerce.boolean().default(false),
    SIP_PORT: z.coerce.number().optional(),
    PJSIP_PORT: z.coerce.number().default(5060),
    // WebRTC (softphone no browser via SIP.js) - sinalização SIP sobre WebSocket. Sem domínio/TLS
    // ainda, WS_SCHEME fica "ws" (sem criptografia no transporte); trocar pra "wss" quando houver
    // certificado é só mudar essas 3 vars, sem deploy de código novo (ver GET /system/sip-config).
    // PUBLIC_ADDRESS é o mesmo IP/domínio informado no install-asterisk.sh (external_media_address).
    PUBLIC_ADDRESS: z.string().optional(),
    WS_SCHEME: z.enum(['ws', 'wss']).default('ws'),
    WS_PORT: z.coerce.number().default(8088),
    // TTS via ElevenLabs (src/modules/audios/providers/elevenlabs.provider.ts) - a API key é por
    // empresa (Company.elevenLabsApiKey), não global; aqui só a config não-secreta compartilhada
    ELEVENLABS_API_URL: z.string().default('https://api.elevenlabs.io'),
    ELEVENLABS_MODEL_ID: z.string().default('eleven_v3'),
    ELEVENLABS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(30000),
    // Master key pra derivar (HKDF, por companyId) a chave AES-256-GCM de segredos de terceiro
    // cifrados em repouso - ver src/lib/crypto.ts. Hoje só usada por IxcCredential.token.
    ENCRYPTION_MASTER_KEY: z.string().default('your-encryption-master-key-change-in-production'),
}).superRefine((cfg, ctx) => {
    // Defaults públicos de JWT_SECRET/REFRESH_SECRET/ENCRYPTION_MASTER_KEY são inaceitáveis fora de
    // teste (tokens forjáveis e segredos de terceiro descriptografáveis por quem lê o repo). Checa em
    // qualquer NODE_ENV que não seja 'test' - gatear só por 'production' permitiria rodar em produção
    // com os defaults públicos caso alguém suba com NODE_ENV=development por engano (ex: copiando
    // .env.example sem trocar essa linha).
    if (cfg.NODE_ENV === 'test') return
    const check = (key: 'JWT_SECRET' | 'REFRESH_SECRET') => {
        const v = cfg[key]
        if (!v || v.length < 32 || v.startsWith('your-')) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} must be a strong custom secret (>= 32 chars) in production` })
        }
    }
    check('JWT_SECRET')
    check('REFRESH_SECRET')
    if (cfg.JWT_SECRET === cfg.REFRESH_SECRET) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['REFRESH_SECRET'], message: 'REFRESH_SECRET must differ from JWT_SECRET' })
    }
    if (!cfg.ENCRYPTION_MASTER_KEY || cfg.ENCRYPTION_MASTER_KEY.length < 32 || cfg.ENCRYPTION_MASTER_KEY.startsWith('your-')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ENCRYPTION_MASTER_KEY'], message: 'ENCRYPTION_MASTER_KEY must be a strong custom secret (>= 32 chars) in production' })
    }
})

export type Env = z.infer<typeof envSchema>

export const validateEnv = (): Env => {
    try {
        return envSchema.parse(process.env)
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missing = error.issues.map((e) => e.path.join('.')).join(', ')
            throw new Error(`Missing or invalid environment variables: ${missing}`)
        }
        throw error
    }
}
