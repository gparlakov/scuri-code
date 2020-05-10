import * as assert from 'assert';
import * as fs from 'fs';
import { before, suiteSetup, suiteTeardown } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    const folder = vscode.workspace.workspaceFolders![0];

    suiteSetup(async function () {
        // 10 minutes - for downloading and installing the scuri npm package
        this.timeout(10 * 60 * 1000);

        // delete files created by the previous test run (mainly for local development)
        const files = await vscode.workspace.findFiles('**.spec.ts', 'existing.spec.ts')
        files.forEach(f => {
            if (fs.existsSync(f.path)) {
                fs.unlinkSync(f.path);
            }
        });

        return await vscode.commands.executeCommand("scuri:install-deps");
    })

    test('should create spec when missing', async () => {

        const fileName = folder.uri.path + "/example.ts";
        const fileNameTest = folder.uri.path + "/example.spec.ts";

        // open a file 
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        const editor = await vscode.window.showTextDocument(example);

        const res = await vscode.commands.executeCommand("scuri:generate");
        console.log('command', res)
        const spec = await vscode.workspace.openTextDocument(fileNameTest);        
        assert.notEqual(null, spec);
        const text = spec.getText();
        assert.equal(true, text.includes("function setup()"));
    });

    test('should create for file with spaces', async function() {
        // arrange
        const fileName = folder.uri.path + "/spaced folder/my spaced component.ts";
        const fileNameTest = folder.uri.path + "/spaced folder/my spaced component.spec.ts";
        // open a file 
        const example = await vscode.workspace.openTextDocument(fileName);
        // and have it be the active editor
        await vscode.window.showTextDocument(example);

        // act
        await vscode.commands.executeCommand("scuri:generate");

        // assert
        const spec = await vscode.workspace.openTextDocument(fileNameTest);        
        assert.notEqual(null, spec);
        const text = spec.getText();
        assert.equal(true, text.includes("function setup()"));
    });
});
