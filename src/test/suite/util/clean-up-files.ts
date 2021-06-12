import { workspace } from 'vscode';
import { existsSync, unlinkSync } from 'fs';
const { findFiles } = workspace;

export async function cleanUpFiles(...args: Parameters<typeof findFiles>) {
  // delete files created by the previous test run (mainly for local development)
  const files = await workspace.findFiles('**.spec.ts', 'existing.spec.ts');
  files.forEach((f) => {
    if (existsSync(f.path)) {
      unlinkSync(f.path);
    }
  });
}
