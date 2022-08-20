import * as assert from 'assert';
import { suiteSetup, test } from 'mocha';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { workspace, commands, window  } from 'vscode';
import { activateIfNotActive } from './util/activate-if-not-active';
import { cleanUpFiles } from './util/clean-up-files';
const { executeCommand } = commands;

suite('Show errors', () => {
  const folder = workspace.workspaceFolders![0];

  suiteSetup(async function () {
    // 10 minutes - for downloading and installing the scuri npm package
    this.timeout(10 * 60 * 1000);
    await activateIfNotActive();
    return await executeCommand('scuri:install-deps');
  });

  test('should inform about not opened file', async () => {
    // arrange
    // close all open editors
    await commands.executeCommand('workbench.action.closeAllEditors');
    // act
    const res = await executeCommand<string>('scuri:generate');

    // assert
    assert.strictEqual(res?.includes('A source file needs to be opened for SCuri to work on it.'), true);
  });

  // intermittently reports 'Nothing to be done'????
  test('should inform about created', async () => {
    // arrange
    await cleanUpFiles();
    // open a file
    const example = await workspace.openTextDocument(folder.uri.path + '/example.ts');
    // and DON'T have it be the active editor
    await window.showTextDocument(example);

    // act
    const res = await executeCommand<string>('scuri:generate');
    console.error('--------', res);
    // assert
    assert.strictEqual(res?.includes('example.spec.ts'), true);
    assert.strictEqual(res?.includes('CREATE'), true);
  });
});

