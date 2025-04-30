import yargs from 'yargs'
import { runners } from '../types.js'
import { run } from '../run.js'

const cli = yargs(process.argv.slice(2))
    .locale("en")
    .option('runner', { type: "string", demandOption: true })
    .help()
    .alias('h', 'help')

const { runner } = await cli.parse()

const maybeRunner = runners.find((e) => e == runner)

if (!maybeRunner) {
    cli.showHelp()
    console.error("Available runners", runner)
    process.exit(1)
}

await run.integration(maybeRunner)
