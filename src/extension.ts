// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as c from "child_process";
import * as fs from "fs";
import { EOL } from "os";
import { join, relative } from "path";
import { promisify } from "util";
import {
  commands,
  ExtensionContext,
  OutputChannel,
  ProgressLocation,
  window,
  workspace
} from "vscode";

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

let scuriPath: string;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const channel = window.createOutputChannel("SCuri");
  // init the path
  scuriPath = join(context.globalStoragePath, "deps");

  // commands
  const generateCommand = commands.registerCommand(
    "scuri:generate",
    scuriCommand(context, channel, runScuriSchematic)
  );
  context.subscriptions.push(generateCommand);

  const overwriteCommand = commands.registerCommand(
    "scuri:update",
    scuriCommand(context, channel, runScuriSchematic, "--update")
  );
  context.subscriptions.push(overwriteCommand);

  const updateCommand = commands.registerCommand(
    "scuri:overwrite",
    scuriCommand(context, channel, runScuriSchematic, "--force")
  );
  context.subscriptions.push(updateCommand);

  const commandInstallDependencies = commands.registerCommand("scuri:install-deps", () =>
    installDeps(channel, context)
  );
  context.subscriptions.push(commandInstallDependencies);

  context.subscriptions.push(
    commands.registerCommand("scuri:auto-spy", () => takeAutospyArguments(context, channel))
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // deps are installed in the extension folder managed by vscode - it should take care of deleting them...
}

function scuriCommand(
  context: ExtensionContext,
  channel: OutputChannel,
  command: typeof runScuriSchematic,
  options?: string,
  schematic: "spec" | "autospy" = "spec"
) {
  return () => {
    window.withProgress({ location: ProgressLocation.Window, title: "Running SCuri command" }, (p, t) => {
      return areDepsInstalled()
        .then(installed =>
          !installed
            ? installDeps(channel, context).then(
                () => "",
                v => {
                  throw v;
                }
              )
            : ""
        )
        .then(() => {
          const a = window.activeTextEditor;
          if (a !== undefined) {
            const root = workspace.getWorkspaceFolder(a.document.uri);
            if (root === undefined) {
              window.showErrorMessage(
                "There needs to be an open folder with an angular app inside it for SCuri to create/update specs."
              );
            } else {
              options = options || "";
              // need to add --debug false as the schematics engine assumes debug true when specifying the schematic by folder vs package name
              options += " --debug false";
              command(
                workspace.asRelativePath(a.document.fileName),
                root.uri.fsPath,
                channel,
                options,
                schematic
              );
            }
          } else {
            window.showErrorMessage("A file needs to be opened for SCuri to create/update specs for.");
          }
        });
    });
  };
}

function runScuriSchematic(
  activeFileName: string,
  root: string,
  channel: OutputChannel,
  options?: string,
  schematic: "spec" | "autospy" = "spec"
) {
  const schematicsExecutable = join(scuriPath, "node_modules", ".bin", "schematics");
  // needs to be relative because c: will trip the schematics engine to take everything after the colon and treat it as the name of the schematics - think scuri:spec -> c:\programfiles
  const schematicsRelativePath = relative(
    root,
    join(scuriPath, "node_modules", "scuri", "src", "collection.json")
  );

  channel.appendLine(
    `${root}>${schematicsExecutable} ${schematicsRelativePath}:${schematic} --name "${activeFileName}" ${
      options ? options : ""
    }`
  );

  c.exec(
    `"${schematicsExecutable}" "${schematicsRelativePath}:${schematic}" --name "${activeFileName}" ${
      options ? options : ""
    }`,
    { cwd: root },
    // child process output handler
    (e, out, err) => {
      if (e !== null) {
        if (e.message && e.message.match(/[Cc]ould not find module.*scuri/)) {
          const message =
            "SCuri is required to run SCuri Create Spec command. Run 'SCuri Install Dependencies' from VS Code command (F1 / Cmd + P)";
          window.showErrorMessage(message);
          channel.appendLine(message);
        } else if (e.message && e.message.match(/Cannot find module.*schematics.js'/)) {
          const message =
            "Schematics cli is required to run SCuri Create Spec. Run 'SCuri Install Dependencies' from VS Code command (F1 / Cmd + P)";

          window.showErrorMessage(message);
          channel.appendLine(message);
        } else if (
          e.message.match(
            /The spec file already exists. Please specify --update or -u if you want to update the spec file./
          ) ||
          e.message.match(/ERROR!.*already exists\./)
        ) {
          const message =
            "The spec file already exists. Please use SCuri Update if you want to update the spec file. Or SCuri Create Spec (overwrite) to overwrite the existing spec file with a fresh spec.";
          window.showErrorMessage(message);
          channel.appendLine(message);
        } else {
          channel.appendLine(e.message);

          console.log(
            `---------------- Could not run ${e.cmd} ${EOL}------ with error: ${e.message} ${EOL}${
              e.stack && !e.message.includes(e.stack) ? "------  with stack" + e.stack : ""
            }`
          );
        }
      } else {
        // tslint:disable-next-line: triple-equals
        if (err != null && err.length > 0) {
          channel.appendLine(err + " (ERROR LINE)");
        }
        // tslint:disable-next-line: triple-equals
        if (out != null && out.length > 0) {
          channel.appendLine(out);
        }
      }
    }
  );
}

function installDeps(channel: OutputChannel, context?: ExtensionContext) {
  if (context === null || context === undefined) {
    throw new Error("Context required");
  }

  // check the folder
  return window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Installing deps",
      cancellable: true
    },
    (progress, token) => {
      token.onCancellationRequested(() => {
        console.log("User canceled the long running operation");
        progress.report({ message: "Canceled!" });
      });

      return (
        // check/create if missing globalStorage/gparlakov.scuri-code
        mkDirIfNotExists(context.globalStoragePath)
          // check create if missing globalStorage/gparlakov.scuri-code/deps
          .then(() => mkDirIfNotExists(scuriPath))
          // do not check if deps are installed because we might need to re-install (update!)
          .then(() => {
            return new Promise((res, rej) => {
              const key_installing = "scuri_deps_installing";
              if (context.globalState.get(key_installing)) {
                const message = `Trying to install dependencies multiple times simultaneously.`;
                console.error(message);
                rej(message);
              } else {
                context.globalState.update(key_installing, true);
              }

              channel.appendLine(
                "Start installing deps. Could take a couple of minutes - doing `npm install scuri @angular-devkit/schematics-cli`"
              );

              const proc = c.exec(
                "npm i -S scuri @angular-devkit/schematics-cli && echo installed > success.txt",
                {
                  cwd: scuriPath,
                  maxBuffer: 1000
                }
              );

              proc.stdout.on("data", d => {
                console.log("stdout:", d);
              });
              proc.stderr.on("data", e => {
                console.log("stderr:", e);
              });

              proc.on("exit", code => {
                console.log("exit with", code);
                // finished with installing deps
                context.globalState.update(key_installing, undefined);
                if (code === 0) {
                  channel.appendLine(`Successfully installed SCuri dependencies in ${scuriPath}`);
                  res("Done");
                } else {
                  channel.appendLine("Failure installing deps");
                  rej("Error!");
                }
              });
            });
          })
          .catch(e => {
            channel.appendLine(e.message);
            console.error(`${e.message} ${e.stack}`);
          })
      );
    }
  );
}

function takeAutospyArguments(context: ExtensionContext, channel: OutputChannel) {
  const quickPick = window.createQuickPick();
  quickPick.items = [
    { label: "jest", description: "Create auto-spy.ts for jest" },
    { label: "jasmine", description: "Create auto-spy.ts for jasmine" },
    {
      label: "jest legacy ts",
      description: "Create auto-spy.ts for jest and ts < 2.8 * no conditional types",
      detail: "Choose this option if you are using TypeScript version less than 2.8"
    },
    {
      label: "jasmine legacy ts",
      description: "Create auto-spy.ts for jasmine and ts < 2.8 * no conditional types",
      detail: "Choose this option if you are using TypeScript version less than 2.8"
    }
  ];
  let choice: "jest" | "jasmine" | "jest legacy ts" | "jasmine legacy ts";
  quickPick.onDidChangeSelection(selection => {
    if (selection[0]) {
      choice = selection[0].label as "jest" | "jasmine" | "jest legacy ts" | "jasmine legacy ts";
    }
  });
  quickPick.onDidAccept(() => {
    if (Boolean(choice)) {
      quickPick.hide();

      let options: string;
      switch (choice) {
        case "jest":
          options = "--for jest";
          break;
        case "jasmine":
          options = "--for jasmine";
          break;
        case "jest legacy ts":
          options = "--for jest --legacy";
          break;
        case "jasmine legacy ts":
          options = "--for jasmine --legacy";
          break;
        default:
          warnMeCompileTimeIfIMissAValue(choice);
          options = "--for jest";
          break;
      }

      // create the command and run it immediately
      scuriCommand(context, channel, runScuriSchematic, options, "autospy")();
    }
  });
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
}

function areDepsInstalled() {
  return exists(join(scuriPath, "success.txt"));
}

function mkDirIfNotExists(path: string) {
  return exists(path).then(e => {
    if (!e) {
      console.log(`${path} DOES NOT exist. Creating!`);
      return mkdir(path);
    } else {
      console.log(`${path} exist`);
      return undefined;
    }
  });
}

function warnMeCompileTimeIfIMissAValue(v: never) {
  throw new Error("You missed it!");
}
