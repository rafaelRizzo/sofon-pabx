import 'dotenv/config';
import AsteriskAMI from "../utils/handler.asterisk"

// Singleton - uma única instância compartilhada
const asterisk = new AsteriskAMI({
    host: process.env.ASTERISK_HOST || '127.0.0.1',
    port: Number(process.env.ASTERISK_PORT) || 5038,
    username: process.env.ASTERISK_USER || 'nodejs_user',
    password: process.env.ASTERISK_PASS || 'SuaSenhaSegura123'
})

// Conectar ao iniciar a aplicação (opcional)
asterisk.connect().catch(err => {
    console.error('Falha ao conectar ao Asterisk AMI:', err)
})

export default asterisk