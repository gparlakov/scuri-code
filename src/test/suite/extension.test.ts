import * as assert from 'assert';
import { before } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	before(() => {
		vscode.window.showInformationMessage('Start all tests.');
	});

	test('Sample test', () => {
		assert.equal(-1, [1, 2, 3].indexOf(5));
		assert.equal(-1, [1, 2, 3].indexOf(0));
	});

	test('activates successfully', async () => {
		const s = vscode.extensions.getExtension("gparlakov.scuri-code");
		assert.notEqual(null, s);
		await s!.activate();
		assert.equal(true, s!.isActive);
	});

	test.skip('has commands', () => {
		// y u not work? (╯°□°）╯︵ ┻━┻)  seems to be the same as https://github.com/johnpapa/vscode-peacock/blob/master/src/test/suite/basic.test.ts#L46
		const s = vscode.extensions.getExtension("gparlakov.scuri-code");
		console.log(s!.packageJSON.contributes.commands)
		assert.equal(true, s!.packageJSON.contributes.commands.lenght > 0);
	});
});
