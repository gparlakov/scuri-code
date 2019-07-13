// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { main as schematics } from "@angular-devkit/schematics-cli/bin/schematics";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log("test");
  const channel = vscode.window.createOutputChannel("SCURI");
  channel.appendLine('Congratulations, your extension "scuri-code" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("scuri:generate", () => {
    // The code you place here will be executed every time your command is executed

    const a = vscode.window.activeTextEditor;
    if (a !== undefined) {
      const root = vscode.workspace.getWorkspaceFolder(a.document.uri);
      if (root === undefined) {
        vscode.window.showErrorMessage(
          "There needs to be an open folder with an angular app inside it for SCURI to generate/update specs."
        );
      } else {
        runScuriSchematic(a.document.fileName, root.uri.fsPath, channel);
      }
    } else {
      vscode.window.showErrorMessage("A file needs to be opened for SCURI to generate/update specs for.");
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function runScuriSchematic(activeFileName: string, root: string, channel: vscode.OutputChannel) {
  channel.appendLine(`Working on ${activeFileName} in root: ${root}`);
  channel.show(true);
  // schematics({
  //   args: [
  //     "scuri:spec",
  //     "--name",
  //     activeFileName,
  //     "--workingDirectory",
  //     "c:\\Users\\gparl\\projects\\scuri-code"
  //   ]
  // })
  //   .then()
  //   .catch()
  //   .finally();
}
