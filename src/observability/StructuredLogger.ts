// StructuredLogger.ts — JSON-structured logging for all NEXUS AI operations

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    source: string;
    message: string;
    data?: Record<string, any>;
    phase?: string;
    agent?: string;
    traceId?: string;
}

export class StructuredLogger {
    private static instance: StructuredLogger;
    private entries: LogEntry[] = [];
    private maxEntries = 10000;

    public static getInstance(): StructuredLogger {
        if (!StructuredLogger.instance) {
            StructuredLogger.instance = new StructuredLogger();
        }
        return StructuredLogger.instance;
    }

    public log(level: LogLevel, source: string, message: string, data?: Record<string, any>): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            source,
            message,
            data,
        };

        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }

        // Output to console with structured formatting
        const prefix = `[${entry.timestamp}] [${level}] [${source}]`;
        switch (level) {
            case 'ERROR':
            case 'FATAL':
                console.error(`${prefix} ${message}`, data || '');
                break;
            case 'WARN':
                console.warn(`${prefix} ${message}`, data || '');
                break;
            case 'DEBUG':
                console.debug(`${prefix} ${message}`, data || '');
                break;
            default:
                console.log(`${prefix} ${message}`, data || '');
        }
    }

    public info(source: string, message: string, data?: Record<string, any>): void {
        this.log('INFO', source, message, data);
    }

    public warn(source: string, message: string, data?: Record<string, any>): void {
        this.log('WARN', source, message, data);
    }

    public error(source: string, message: string, data?: Record<string, any>): void {
        this.log('ERROR', source, message, data);
    }

    public debug(source: string, message: string, data?: Record<string, any>): void {
        this.log('DEBUG', source, message, data);
    }

    public getEntries(filter?: { level?: LogLevel; source?: string; limit?: number }): LogEntry[] {
        let results = [...this.entries];
        if (filter?.level) results = results.filter(e => e.level === filter.level);
        if (filter?.source) results = results.filter(e => e.source === filter.source);
        if (filter?.limit) results = results.slice(-filter.limit);
        return results;
    }

    public clear(): void {
        this.entries = [];
    }
}
