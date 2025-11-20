import yargs from 'yargs'
import { runners } from '../types.js'
import { run } from '../run.js'
import { validateCliEnvironment } from '../config/validation.js'
import { sanitizeRunner } from '../config/sanitization.js'

// Validate environment before proceeding
try {
    validateCliEnvironment()
} catch (error) {
    console.error('Environment validation failed:', error)
    process.exit(1)
}

const cli = yargs(process.argv.slice(2))
    .locale("en")
    .option('runner', { type: "string", demandOption: true })
    .help()
    .alias('h', 'help')

const { runner } = await cli.parse()

// Sanitize runner input
const sanitizedRunner = sanitizeRunner(runner, [...runners] as string[]) as typeof runners[number]

const maybeRunner = runners.find((e) => e == sanitizedRunner)

if (!maybeRunner) {
    cli.showHelp()
    console.error("Available runners:", runners.join(', '))
    process.exit(1)
}

await run.integration(maybeRunner)
