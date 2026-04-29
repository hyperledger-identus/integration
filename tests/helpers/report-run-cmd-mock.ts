/**
 * Test double for `cmd()` when running `report.run()` integration tests.
 * Commands are the fixed strings built in src/runner/report.ts (not user input); cwd is a throwaway temp dir.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const ALLURE_OUTPUT_FLAG = /-o\s+(\S+)/;

export function createReportRunCmdHandler(
  tempRoot: string,
  options?: { failAllure?: boolean }
): (command: string) => Promise<string> {
  return async (command: string): Promise<string> => {
    if (command.includes('npx allure generate')) {
      if (options?.failAllure) {
        throw new Error('allure generate failed');
      }
      const outDirMatch = ALLURE_OUTPUT_FLAG.exec(command);
      if (!outDirMatch) {
        throw new Error(`unexpected allure command: ${command}`);
      }
      const outDir = outDirMatch[1];
      mkdirSync(outDir, { recursive: true });
      mkdirSync(join(outDir, 'history'), { recursive: true });
      writeFileSync(join(outDir, 'app.js'), '', 'utf-8');
      return '';
    }
    const [cmdName, ...args] = command.split(' ');
    try {
      if (cmdName === 'mkdir') {
        const pathArg = args.find(a => !a.startsWith('-'));
        if (pathArg) mkdirSync(join(tempRoot, pathArg), { recursive: true });
        return '';
      }
      if (cmdName === 'rm') {
        const pathArg = args.find(a => !a.startsWith('-'));
        if (pathArg) rmSync(join(tempRoot, pathArg), { recursive: true, force: true });
        return '';
      }
      if (cmdName === 'cp') {
        const pathArgs = args.filter(a => !a.startsWith('-'));
        if (pathArgs.length >= 2) {
          const src = pathArgs[0];
          const dest = pathArgs[1];
          // Handle trailing /. or . in cp -r src/. dest
          const cleanSrc = src?.replace(/\/\.$/, '').replace(/\.$/, '');
          if (cleanSrc && dest) cpSync(join(tempRoot, cleanSrc), join(tempRoot, dest), { recursive: true });
        }
        return '';
      }
      execSync(command, { cwd: tempRoot, stdio: 'ignore' }); // NOSONAR
    } catch (e) {
      // Swallow errors for common Linux commands that might fail on Windows if not handled above
      if (['rm', 'cp', 'mkdir'].includes(cmdName || '')) {
        return '';
      }
      throw e;
    }
    return '';
  };
}
