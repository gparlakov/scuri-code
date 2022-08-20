import * as assert from 'assert';
import { suiteSetup, test } from 'mocha';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { activateIfNotActive } from './util/activate-if-not-active';


suite('Extension Test Suite', () => {
    const folder = vscode.workspace.workspaceFolders![0];

    suiteSetup(async function () {
        // 10 minutes - for downloading and installing the scuri npm package
        this.timeout(10 * 60 * 1000);
        await activateIfNotActive();
        return await vscode.commands.executeCommand("scuri:install-deps");
    });

    test('should create spec when missing', async () => {

        const fileName = folder.uri.path + "/example.ts";

        // open a file
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        await vscode.commands.executeCommand("scuri:generate");
        const createdFile = await waitTillFileExists('example.spec.ts');
        const spec = await vscode.workspace.openTextDocument(createdFile);
        assert.notEqual(null, spec);
        const text = spec.getText();
        assert.equal(true, text.includes("function setup()"));
    });

    test('should create for file with spaces', async function() {
        // arrange
        const fileName = folder.uri.path + "/spaced folder/my spaced component.ts";
        // open a file
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        // act
        await vscode.commands.executeCommand("scuri:generate");
        const created = await waitTillFileExists('**/my spaced component.spec.ts');
        // assert
        const spec = await vscode.workspace.openTextDocument(created);
        assert.notEqual(null, spec);
        const text = spec.getText();
        assert.equal(true, text.includes("function setup()"));
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
