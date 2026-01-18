declare module 'asterisk-manager' {
    interface AsteriskManagerOptions {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        events?: string;
    }

    interface ActionOptions {
        action: string;
        command?: string;
        [key: string]: any;
    }

    interface ActionCallback {
        (err: Error | null, res: any): void;
    }

    class AsteriskManager {
        // Construtor com múltiplas assinaturas
        constructor(port: number, host: string, username: string, password: string, events: boolean);
        constructor(options: AsteriskManagerOptions);

        connect(callback?: () => void): void;
        keepConnected(): void;
        disconnect(): void;
        action(options: ActionOptions, callback: ActionCallback): void;
        on(event: 'connect', callback: () => void): void;
        on(event: 'error', callback: (err: Error) => void): void;
        on(event: 'close', callback: () => void): void;
        on(event: string, callback: (...args: any[]) => void): void;
    }

    export = AsteriskManager;
}