import AsteriskManager from 'asterisk-manager';

interface AsteriskConfig {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    events?: string;
}

interface CommandResponse {
    response?: string;
    message?: string;
    [key: string]: any;
}

class AsteriskAMI {
    private config: Required<AsteriskConfig>;
    private ami: any | null;
    private connected: boolean;

    constructor(config: AsteriskConfig = {}) {
        this.config = {
            host: config.host || '127.0.0.1',
            port: config.port || 5038,
            username: config.username || 'nodejs_user',
            password: config.password || 'SuaSenhaSegura123',
            events: config.events || 'off'
        };
        
        this.ami = null;
        this.connected = false;
    }

    // Conectar ao AMI
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected && this.ami) {
                return resolve();
            }

            // asterisk-manager@0.2.0 usa (port, host, username, password, events)
            this.ami = new AsteriskManager(
                this.config.port,
                this.config.host,
                this.config.username,
                this.config.password,
                this.config.events === 'on'
            );

            this.ami.on('connect', () => {
                this.connected = true;
                console.log('✓ Conectado ao Asterisk AMI');
                resolve();
            });

            this.ami.on('error', (err: Error) => {
                this.connected = false;
                console.error('✗ Erro AMI:', err);
                reject(err);
            });

            this.ami.on('close', () => {
                this.connected = false;
                console.log('⚠ Conexão AMI fechada');
            });

            // keepConnected() mantém a conexão ativa
            this.ami.keepConnected();
        });
    }

    // Executar comando genérico
    async executeCommand(command: string): Promise<CommandResponse> {
        try {
            if (!this.connected) {
                await this.connect();
            }

            return new Promise((resolve, reject) => {
                this.ami.action({
                    action: 'Command',
                    command
                }, (err: Error | null, res: CommandResponse) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            throw new Error(`Erro ao executar comando: ${message}`);
        }
    }

    // Recarregar SIP
    async reloadSIP(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('sip reload');
            console.log('✓ SIP recarregado');
            return result;
        } catch (error) {
            console.error('✗ Erro ao recarregar SIP:', error);
            throw error;
        }
    }

    // Recarregar PJSIP
    async reloadPJSIP(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('pjsip reload');
            console.log('✓ PJSIP recarregado');
            return result;
        } catch (error) {
            console.error('✗ Erro ao recarregar PJSIP:', error);
            throw error;
        }
    }

    // Recarregar dialplan
    async reloadDialplan(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('dialplan reload');
            console.log('✓ Dialplan recarregado');
            return result;
        } catch (error) {
            console.error('✗ Erro ao recarregar Dialplan:', error);
            throw error;
        }
    }

    // Core reload
    async reloadCore(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('core reload');
            console.log('✓ Core recarregado');
            return result;
        } catch (error) {
            console.error('✗ Erro ao recarregar Core:', error);
            throw error;
        }
    }

    // Listar endpoints PJSIP
    async showPJSIPEndpoints(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('pjsip show endpoints');
            return result;
        } catch (error) {
            console.error('✗ Erro ao listar endpoints:', error);
            throw error;
        }
    }

    // Listar peers SIP
    async showSIPPeers(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('sip show peers');
            return result;
        } catch (error) {
            console.error('✗ Erro ao listar peers:', error);
            throw error;
        }
    }

    // Status de canal específico
    async showChannel(channel: string): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand(`core show channel ${channel}`);
            return result;
        } catch (error) {
            console.error('✗ Erro ao verificar canal:', error);
            throw error;
        }
    }

    // Desconectar
    disconnect(): void {
        if (this.ami) {
            this.ami.disconnect();
            this.connected = false;
            console.log('✓ Desconectado do AMI');
        }
    }

    // Verificar se está conectado
    isConnected(): boolean {
        return this.connected;
    }
}

export default AsteriskAMI;