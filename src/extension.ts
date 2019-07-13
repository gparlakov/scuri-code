// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as c from "child_process";
import { EOL } from "os";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const channel = vscode.window.createOutputChannel("SCURI");
  channel.appendLine('Congratulations, your extension "scuri-code" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const generateCommand = vscode.commands.registerCommand(
    "scuri:generate",
    scuriCommand(channel, runScuriSchematic)
  );
  context.subscriptions.push(generateCommand);

  const overwriteCommand = vscode.commands.registerCommand(
    "scuri:update",
    scuriCommand(channel, runScuriSchematic, "--update")
  );
  context.subscriptions.push(overwriteCommand);

  const updateCommand = vscode.commands.registerCommand(
    "scuri:overwrite",
    scuriCommand(channel, runScuriSchematic, "--force")
  );
  context.subscriptions.push(updateCommand);

  const commandInstallDependencies = vscode.commands.registerCommand(
    "scuri:install-deps",
    scuriCommand(channel, installDeps)
  );
  context.subscriptions.push(commandInstallDependencies);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function scuriCommand(
  channel: vscode.OutputChannel,
  command: (file: string, root: string, channel: vscode.OutputChannel, options?: string) => void,
  options?: string
) {
  return () => {
    // The code you place here will be executed every time your command is executed

    const a = vscode.window.activeTextEditor;
    if (a !== undefined) {
      const root = vscode.workspace.getWorkspaceFolder(a.document.uri);
      if (root === undefined) {
        vscode.window.showErrorMessage(
          "There needs to be an open folder with an angular app inside it for SCURI to generate/update specs."
        );
      } else {
        command(vscode.workspace.asRelativePath(a.document.fileName), root.uri.fsPath, channel, options);
      }
    } else {
      vscode.window.showErrorMessage("A file needs to be opened for SCURI to generate/update specs for.");
    }
  };
}

function runScuriSchematic(
  activeFileName: string,
  root: string,
  channel: vscode.OutputChannel,
  options?: string
) {
  channel.appendLine(`${root}>npx schematics scuri:spec --name ${activeFileName} ${options}`);
  channel.show();

  c.exec(`npx schematics scuri:spec --name ${activeFileName} ${options}`, { cwd: root }, (e, out, err) =>
    execOutputHandler(e, out, err, channel)
  );
}

function installDeps(_: string, root: string, channel: vscode.OutputChannel) {
  channel.appendLine(`Running 'npm install --save-dev @angular-devkit/schematics-cli scuri in ${root}`);
  channel.show();

  c.exec("npm install --save-dev @angular-devkit/schematics-cli scuri", { cwd: root }, (e, out, err) =>
    execOutputHandler(e, out, err, channel)
  );
}

function execOutputHandler(
  e: c.ExecException | null,
  out: string,
  err: string,
  channel: vscode.OutputChannel
) {
  if (e !== null) {
    if (e.message && e.message.match(/[Cc]ould not find module.*scuri/)) {
      const message =
        "Scuri is required to run Scuri generate command. Run 'Scuri install dependencies' or Install scuri locally - `npm install --save-dev scuri`";
      vscode.window.showErrorMessage(message);
      channel.appendLine(message);
    } else if (e.message && e.message.match(/Cannot find module.*schematics.js'/)) {
      const message =
        "Schematics cli is required to run Scuri generate command. Run 'Scuri install dependencies' or Install Schematics locally - `npm install --save-dev @angular-devkit/schematics-cli`";

      vscode.window.showErrorMessage(message);
      channel.appendLine(message);
    } else if (
      e.message.match(
        /The spec file already exists. Please specify --update or -u if you want to update the spec file./
      )
    ) {
      vscode.window.showErrorMessage(
        "The spec file already exists. Please use Scuri Update if you want to update the spec file. Or Scuri Generate (overwrite) to overwrite the existing spec file with a fresh spec."
      );
    } else {
      channel.appendLine(
        `---------------- Could not run ${e.cmd} ${EOL}------ with error: ${e.message} ${EOL}${
          e.stack && !e.message.includes(e.stack) ? "------  with stack" + e.stack : ""
        }`
      );
    }
  } else {
    // tslint:disable-next-line: triple-equals
    if (err != null && err.length > 0) {
      channel.appendLine("ERROR: " + err);
    }
    // tslint:disable-next-line: triple-equals
    if (out != null && out.length > 0) {
      channel.appendLine("CONSOLE: " + out);
    }
  }
}
