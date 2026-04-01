/**
 * Test double for `cmd()` when running `report.run()` integration tests.
 * Commands are the fixed strings built in src/runner/report.ts (not user input); cwd is a throwaway temp dir.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
    execSync(command, { cwd: tempRoot, stdio: 'ignore' }); // NOSONAR — see file header; bounded test cwd
    return '';
  };
}
