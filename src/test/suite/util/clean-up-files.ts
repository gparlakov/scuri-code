import { workspace } from 'vscode';
import { existsSync, unlinkSync } from 'fs';

export async function cleanUpFiles() {
  // delete files created by the previous test run (mainly for local development)
  const files = await workspace.findFiles('**.spec.ts', 'existing.spec.ts');
  files.forEach((f) => {
    if (existsSync(f.path)) {
      unlinkSync(f.path);
    }
  });
}
