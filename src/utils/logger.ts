/**
 * Structured logging utility for consistent log formatting across the application
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

interface LogContext {
    component?: string
    runner?: string
    version?: string
    [key: string]: unknown
}

class Logger {
    private minLevel: LogLevel = LogLevel.INFO
    private isDebug: boolean = false

    constructor() {
        this.isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1'
        if (this.isDebug) {
            this.minLevel = LogLevel.DEBUG
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.minLevel
    }

    private formatMessage(prefix: string, message: string, context?: LogContext): string {
        const parts = [prefix, message]
        if (context) {
            const contextStr = Object.entries(context)
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}=${value}`)
                .join(' ')
            if (contextStr) {
                parts.push(`[${contextStr}]`)
            }
        }
        return parts.join(' ')
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage('[DEBUG]', message, context))
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('[INFO]', message, context))
        }
    }

    warn(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('[WARN]', message, context))
        }
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorDetails = error instanceof Error && error.stack ? `\nStack trace: ${error.stack}` : ''
            console.error(this.formatMessage('[ERROR]', `${message}: ${errorMessage}`, context) + errorDetails)
        }
    }
}

export const logger = new Logger()

