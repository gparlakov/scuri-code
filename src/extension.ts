// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { main as schematics } from "@angular-devkit/schematics-cli/bin/schematics";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "scuri-code" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("scuri:generate", () => {
    // The code you place here will be executed every time your command is executed

    const a = vscode.window.activeTextEditor;
    if (a !== undefined) {
      // Display a message box to the user
      runScuriSchematic(a.document.fileName);
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function runScuriSchematic(activeFileName: string) {
  schematics({
    args: [
      "scuri:spec",
      "--name",
      activeFileName,
      "--workingDirectory",
      "c:\\Users\\gparl\\projects\\scuri-code"
    ]
  })
    .then()
    .catch()
    .finally();
}
