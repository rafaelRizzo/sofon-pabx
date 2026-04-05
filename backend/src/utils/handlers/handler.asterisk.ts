import AsteriskManager from 'asterisk-manager';
import { logger } from '../logger';

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
            username: config.username || 'ami_user',
            password: config.password || 'secret_password',
            events: config.events || 'off'
        };

        this.ami = null;
        this.connected = false;
    }

    // Connect to the Asterisk AMI
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected && this.ami) {
                return resolve();
            }

            // asterisk-manager@0.2.0 use (port, host, username, password, events)
            this.ami = new AsteriskManager(
                this.config.port,
                this.config.host,
                this.config.username,
                this.config.password,
                this.config.events === 'on'
            );

            this.ami.on('connect', () => {
                this.connected = true;
                console.log('✓ Connected to AMI');
                resolve();
            });

            this.ami.on('error', (err: Error) => {
                this.connected = false;
                logger.error(`✗ Error AMI: ${err}`);
                reject(err);
            });

            this.ami.on('close', () => {
                this.connected = false;
                console.log('⚠ Connection closed');
            });

            // Keep the connection alive
            this.ami.keepConnected();
        });
    }

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
            const message = error instanceof Error ? error.message : 'Error unknown';
            throw new Error(`Error executing command: ${message}`);
        }
    }

    async reloadSIP(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('sip reload');
            logger.info('✓ sip reload successful');
            return result;
        } catch (error) {
            logger.error(`✗ Error reloading SIP: ${error}`);
            throw error;
        }
    }

    async reloadPJSIP(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('pjsip reload');
            console.log('✓ PJSIP reload successful');
            return result;
        } catch (error) {
            logger.error(`✗ Error reloading PJSIP: ${error}`);
            throw error;
        }
    }

    async reloadDialplan(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('dialplan reload');
            console.log('✓ Dialplan reload successful');
            return result;
        } catch (error) {
            logger.error(`✗ Error reloading Dialplan: ${error}`);
            throw error;
        }
    }

    async reloadCore(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('core reload');
            console.log('✓ Core reload successful');
            return result;
        } catch (error) {
            logger.error(`✗ Error reloading Core: ${error}`);
            throw error;
        }
    }

    async showPJSIPEndpoints(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('pjsip show endpoints');
            return result;
        } catch (error) {
            logger.error(`✗ Error showing PJSIP endpoints: ${error}`);
            throw error;
        }
    }

    async showSIPPeers(): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand('sip show peers');
            return result;
        } catch (error) {
            logger.error(`✗ Erro showing SIP peers: ${error}`);
            throw error;
        }
    }

    async showChannel(channel: string): Promise<CommandResponse> {
        try {
            const result = await this.executeCommand(`core show channel ${channel}`);
            return result;
        } catch (error) {
            logger.error(`✗ Error showing channel: ${error}`);
            throw error;
        }
    }

    disconnect(): void {
        if (this.ami) {
            this.ami.disconnect();
            this.connected = false;
            console.log('✓ Disconnected from AMI');
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

export default AsteriskAMI;