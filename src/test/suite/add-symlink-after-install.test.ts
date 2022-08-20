import * as assert from 'assert';
import { suiteSetup, test, afterEach } from 'mocha';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { execSync } from 'child_process'
import { cleanUpFiles } from './util/clean-up-files';

suite('Install deps', () => {
    const folder = vscode.workspace.workspaceFolders![0];
    suiteSetup(async function () {
        // wait up to 5 minutes - for downloading and installing the scuri npm package and scuri latest version again
        this.timeout(5 * 60 * 1000);

        const s = vscode.extensions.getExtension("gparlakov.scuri-code");
        if(s && !s.isActive) {
            await s.activate();
        }

        // clear any preinstalled version of scuri from deps
        execSync('rm -rf $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps/node_modules/scuri', { cwd: '/', encoding: 'utf8', stdio: 'ignore' })
    })

    afterEach(cleanUpFiles)

    test('should create symlink src -> dist when installing latest version (1.2.0 and above)', async function test() {

        await vscode.commands.executeCommand("scuri:install-deps");

        const fileName = folder.uri.path + "/example.ts";

        // open a file
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        await vscode.commands.executeCommand("scuri:generate");
        const createdFile = await waitTillFileExists('example.spec.ts');
        const spec = await vscode.workspace.openTextDocument(createdFile);
        assert.notStrictEqual(null, spec);
        const text = spec.getText();
        assert.strictEqual(true, text.includes("function setup()"));
    });

    test('should work as is for upgrading from an older version to scuri latest which ships dist', async function () {

        // install older version of scuri
        console.log('------------', execSync('cd $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps && npm i scuri@1.1.0').toString('utf8'))

        const version = execSync('cat $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps/node_modules/scuri/package.json | grep version').toString('utf8');
        assert.strictEqual(true, version.includes('"version": "1.1.0"'));

        await vscode.commands.executeCommand("scuri:install-deps");

        const fileName = folder.uri.path + "/example.ts";

        // open a file
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        await vscode.commands.executeCommand("scuri:generate");
        const createdFile = await waitTillFileExists('example.spec.ts');
        const spec = await vscode.workspace.openTextDocument(createdFile);
        assert.notStrictEqual(null, spec);
        const text = spec.getText();
        assert.strictEqual(true, text.includes("function setup()"));
    });
    
    test('should work as is for older version scuri (1.1.0 and below) which ships /src', async function () {

        // install older version of scuri
        console.log('------------', execSync('cd $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps && npm i scuri@1.1.0').toString('utf8'))

        const version = execSync('cat $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps/node_modules/scuri/package.json | grep version').toString('utf8');
        assert.strictEqual(true, version.includes('"version": "1.1.0"'));

        // do not install deps just run the example
        const fileName = folder.uri.path + "/example.ts";

        // open a file
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        await vscode.commands.executeCommand("scuri:generate");
        const createdFile = await waitTillFileExists('example.spec.ts');
        const spec = await vscode.workspace.openTextDocument(createdFile);
        assert.notStrictEqual(null, spec);
        const text = spec.getText();
        assert.strictEqual(true, text.includes("function setup()"));
    });
});


function waitTillFileExists(fileName: string, step: number = 100, timeout: number = 9900): Promise<Uri> {
    return new Promise<Uri[]>(res => setTimeout(() => {
        res(vscode.workspace.findFiles(fileName));
    }, step))
        .then((files: Uri[]) => {
            return step >= timeout
                ? Promise.reject(`Timed out looking for ${fileName}`)
                : files.length > 0
                    ? files[0]
                    : waitTillFileExists(fileName, step, timeout - step);
        });
}
