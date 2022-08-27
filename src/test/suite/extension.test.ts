import * as assert from 'assert';
import { before } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { schematicsCliVersion, scuriVersionConfig } from '../../types';
import { getCurrentInstalledVersion } from './util/get-current-installed-version';

suite('Extension Test Suite', () => {
	before(() => {
		// vscode.window.showInformationMessage('Start all tests.');
	});

	test('activates successfully', async () => {
		const s = vscode.extensions.getExtension("gparlakov.scuri-code");
		assert.notStrictEqual(null, s);
		await s!.activate();
		assert.strictEqual(true, s!.isActive);
	});

	test.skip('has commands', () => {
		// y u not work? (╯°□°）╯︵ ┻━┻)  seems to be the same as https://github.com/johnpapa/vscode-peacock/blob/master/src/test/suite/basic.test.ts#L46
		const s = vscode.extensions.getExtension("gparlakov.scuri-code");
		console.log(s!.packageJSON.contributes.commands);
		assert.strictEqual(true, s!.packageJSON.contributes.commands.length > 0);
	});

	test.only('install specified versions of scuri and angular schematics', async () => {
		const config = vscode.workspace.getConfiguration();
		await config.update(scuriVersionConfig, '1.3.0-rc.6');
		await config.update(schematicsCliVersion, '14.0.0')

        await vscode.commands.executeCommand("scuri:install-deps");

		const scuriVersionMatch = getCurrentInstalledVersion('scuri').includes('1.3.0-rc.6')
		assert.strictEqual(true, scuriVersionMatch)

		const schematicsCliVersionMatch = getCurrentInstalledVersion('@angular-devkit/schematics-cli').includes('14.0.0')
		assert.strictEqual(true, schematicsCliVersionMatch)


	})
});
