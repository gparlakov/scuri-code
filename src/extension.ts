// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as c from "child_process";
import { EOL } from "os";
import { window, ExtensionContext, ProgressLocation, commands, OutputChannel, workspace } from "vscode";
import { join, relative } from "path";
import * as fs from "fs";

import { promisify } from "util";

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const exec = promisify(c.exec);
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const channel = window.createOutputChannel("SCURI");
  const scuriPath = join(context.globalStoragePath, "deps");

  // check the folder
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Installing deps",
      cancellable: true
    },
    (progress, token) => {
      token.onCancellationRequested(() => {
        console.log("User canceled the long running operation");
      });

      progress.report({ increment: 0 });

      progress.report({ increment: 10, message: "Starting install" });

      return (
        exists(scuriPath)
          .then(e => {
            progress.report({ increment: 10, message: `Path ${scuriPath} ${e ? "" : "not"} exists` });
            if (!e) {
              channel.appendLine(`${scuriPath} DOES NOT exist`);
              return mkdir(scuriPath);
            } else {
              channel.appendLine(`${scuriPath} exist`);
              return undefined;
            }
          })
          // then check if the dependencies are already installed
          .then(() => {
            progress.report({ increment: 20, message: "Checking deps" });
            return exists(join(context.globalStoragePath, "scuri", "package-lock.json"));
          })
          .then(packagesInstalled => {
            channel.show();
            return new Promise((res, rej) => {
              if (!packagesInstalled) {
                channel.appendLine("installing deps");
                progress.report({ increment: 20, message: "Installing deps" });

                const proc = c.exec("npm i -S scuri @angular-devkit/schematics-cli", {
                  cwd: scuriPath
                });
                proc.on("message", m => {
                  channel.appendLine(m);
                  progress.report({ increment: 1, message: "Installing deps" });
                });

                proc.on("error", m => {
                  channel.appendLine(m.message + EOL + m.stack);
                  progress.report({ increment: 100, message: "Installing deps failed" });
                  rej();
                });
                proc.on('exit', () => {
                  res();
                });
                // return exec("npm i -S scuri @angular-devkit/schematics-cli", {
                //   encoding: "buffer",
                //   cwd: scuriPath
                // }).then(({stdout, stderr}) => {
                //   stdout.copy
                // });
              } else {
                channel.appendLine("deps already installed!");
                res();
              }
            });
          })
          .catch(e => {
            channel.appendLine(e.message);
            console.error(`${e.message} ${e.stack}`);
          })
      );
    }
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const generateCommand = commands.registerCommand(
    "scuri:generate",
    scuriCommand(channel, runScuriSchematic)
  );
  context.subscriptions.push(generateCommand);

  const overwriteCommand = commands.registerCommand(
    "scuri:update",
    scuriCommand(channel, runScuriSchematic, "--update")
  );
  context.subscriptions.push(overwriteCommand);

  const updateCommand = commands.registerCommand(
    "scuri:overwrite",
    scuriCommand(channel, runScuriSchematic, "--force")
  );
  context.subscriptions.push(updateCommand);

  const commandInstallDependencies = commands.registerCommand(
    "scuri:install-deps",
    scuriCommand(channel, installDeps, undefined, context)
  );
  context.subscriptions.push(commandInstallDependencies);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function scuriCommand(
  channel: OutputChannel,
  command: (
    file: string,
    root: string,
    channel: OutputChannel,
    options?: string,
    context?: ExtensionContext
  ) => void,
  options?: string,
  context?: ExtensionContext
) {
  return () => {
    // The code you place here will be executed every time your command is executed

    const a = window.activeTextEditor;
    if (a !== undefined) {
      const root = workspace.getWorkspaceFolder(a.document.uri);
      if (root === undefined) {
        window.showErrorMessage(
          "There needs to be an open folder with an angular app inside it for SCURI to generate/update specs."
        );
      } else {
        command(workspace.asRelativePath(a.document.fileName), root.uri.fsPath, channel, options, context);
      }
    } else {
      window.showErrorMessage("A file needs to be opened for SCURI to generate/update specs for.");
    }
  };
}

function runScuriSchematic(activeFileName: string, root: string, channel: OutputChannel, options?: string) {
  channel.appendLine(`${root}>npx schematics scuri:spec --name ${activeFileName} ${options}`);
  channel.show();

  c.exec(`npx schematics scuri:spec --name ${activeFileName} ${options}`, { cwd: root }, (e, out, err) =>
    execOutputHandler(e, out, err, channel)
  );
}

function installDeps(
  _: string,
  root: string,
  channel: OutputChannel,
  options?: string,
  context?: ExtensionContext
) {
  if (context === null || context === undefined) {
    throw new Error("Context required");
  }

  const scuriPath = join(context.globalStoragePath, "deps");
  const schematicsExecutable = join(scuriPath, "node_modules", ".bin", "schematics");
  const schematicsRelativePath = relative(
    root,
    join(scuriPath, "node_modules", "scuri", "src", "collection.json")
  );

  channel.appendLine(`Running '${schematicsExecutable} ${schematicsRelativePath}:spec' in ${root}`);
  channel.show();

  c.exec(`${schematicsExecutable} ${schematicsRelativePath}:spec`, { cwd: root }, (e, out, err) => {
    execOutputHandler(e, out, err, channel);
  });

  // c.exec("npm install --save-dev @angular-devkit/schematics-cli scuri", { cwd: root }, (e, out, err) =>
  //   execOutputHandler(e, out, err, channel)
  // );
}

function execOutputHandler(e: c.ExecException | null, out: string, err: string, channel: OutputChannel) {
  if (e !== null) {
    if (e.message && e.message.match(/[Cc]ould not find module.*scuri/)) {
      const message =
        "Scuri is required to run Scuri generate command. Run 'Scuri install dependencies' or Install scuri locally - `npm install --save-dev scuri`";
      window.showErrorMessage(message);
      channel.appendLine(message);
    } else if (e.message && e.message.match(/Cannot find module.*schematics.js'/)) {
      const message =
        "Schematics cli is required to run Scuri generate command. Run 'Scuri install dependencies' or Install Schematics locally - `npm install --save-dev @angular-devkit/schematics-cli`";

      window.showErrorMessage(message);
      channel.appendLine(message);
    } else if (
      e.message.match(
        /The spec file already exists. Please specify --update or -u if you want to update the spec file./
      )
    ) {
      window.showErrorMessage(
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
