// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as c from 'child_process';
import * as fs from 'fs';
import { EOL } from 'os';
import { join, relative } from 'path';
import { promisify } from 'util';
import { commands, ExtensionContext, OutputChannel, ProgressLocation, window, workspace } from 'vscode';
import { scuriVersionConfig, schematicsCliVersion } from './types';

type ScuriLogger = (message: string, o?: {
  skipConsole?: boolean;
  level: 'error' | 'log' | 'warn';
}) => void;

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const symlink = promisify(fs.symlink);

const createLogger = (
    channel: OutputChannel,
    consoleSeparator: string = '----------------'
): ScuriLogger  => (message, o) => {
  channel.appendLine(message);
  if(!o?.skipConsole) {
    console[o?.level ?? 'log'](consoleSeparator, message);
  }
}

let log: ScuriLogger;
let depsPath: string;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const channel = window.createOutputChannel('SCuri');
  // init the path
  depsPath = join(context.globalStoragePath, 'deps');
  log = createLogger(channel);

  // commands
  const generateCommand = commands.registerCommand(
    'scuri:generate',
    scuriCommand(context, channel, runScuriSchematic)
  );
  context.subscriptions.push(generateCommand);

  const overwriteCommand = commands.registerCommand(
    'scuri:update',
    scuriCommand(context, channel, runScuriSchematic, '--update')
  );
  context.subscriptions.push(overwriteCommand);

  const updateCommand = commands.registerCommand(
    'scuri:overwrite',
    scuriCommand(context, channel, runScuriSchematic, '--force')
  );
  context.subscriptions.push(updateCommand);

  const commandInstallDependencies = commands.registerCommand('scuri:install-deps', () =>
    installDeps(channel, context)
  );
  context.subscriptions.push(commandInstallDependencies);

  context.subscriptions.push(
    commands.registerCommand('scuri:auto-spy', () => takeAutospyArguments(context, channel))
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
  schematic: 'spec' | 'autospy' = 'spec'
): () => Thenable<string> {
  return () => {
    return areDepsInstalled()
      .then((installed) => {
        if(!installed){
          return installDeps(channel, context);
        }
        return mkLinkIfSrcNotExists(`${depsPath}/node_modules/scuri`, channel)
      })
      .then(() => {
        const a = window.activeTextEditor;
        // tslint:disable-next-line:triple-equals
        if (a != null && workspace.getWorkspaceFolder(a.document.uri) != null) {
          const root = workspace.getWorkspaceFolder(a.document.uri)!;

          options = options || '';
          // need to add --debug false as the schematics engine assumes debug true when specifying the schematic by folder vs package name
          options += ' --debug false';

          return command(
            workspace.asRelativePath(a.document.uri, false),
            root.uri.fsPath,
            channel,
            options,
            schematic
          );
        }

        const openFile = 'A source file needs to be opened for SCuri to work on it.';
        window.showErrorMessage(openFile);
        return openFile;
      });
  };
}

function runScuriSchematic(
  activeFileName: string,
  root: string,
  channel: OutputChannel,
  options?: string,
  schematic: 'spec' | 'autospy' = 'spec'
): Thenable<string> {
  const schematicsExecutable = join(depsPath, 'node_modules', '.bin', 'schematics');
  // needs to be relative because c: will trip the schematics engine to take everything after the colon and treat it as the name of the schematics - think scuri:spec -> c:\programfiles
  const schematicsRelativePath = relative(
    root,
    join(depsPath, 'node_modules', 'scuri', 'dist', 'collection.json')
  );

  channel.appendLine(
    `${root}>${schematicsExecutable} ${schematicsRelativePath}:${schematic} --name "${activeFileName}" ${options ? options : ''
    }`
  );

  return window
    .withProgress(
      { location: ProgressLocation.Notification, cancellable: false, title: 'Running Scuri command' },
      (progress, _) =>
        new Promise<[c.ExecException | null, string, string]>((res) =>
          c.exec(
            `"${schematicsExecutable}" "${schematicsRelativePath}:${schematic}" --name "${activeFileName}" ${options ? options : ''
            }`,
            { cwd: root },
            // child process output handler
            (e, out, err) => {
              progress.report({ increment: 100 });
              res([e, out, err]);
            }
          )
        )
    )
    .then(([e, out, err]) => {
      channel.appendLine('------------- Finished -------------');
      if (err) {
        channel.appendLine(err);
      }
      if (out) {
        channel.appendLine(out);
      }

      if (out && !e) {
        const success = out.includes('Nothing to be done.')
          ? 'SCuri found nothing to do!'
          : out.match(/create/i)
            ? 'SCuri create successful!'
            : out.match(/update/i)
              ? 'SCuri update successful!'
              : out;

        window.showInformationMessage(success);
        return out;
      }

      let message = out;
      if (e?.message?.match(/[Cc]ould not find module.*scuri/)) {
        message =
          "SCuri is required to run SCuri Create Spec command. Run 'SCuri Install Dependencies' from VS Code command (F1 / Cmd + P)";
      } else if (e?.message?.match(/Cannot find module.*schematics.js'/)) {
        message =
          "Schematics cli is required to run SCuri Create Spec. Run 'SCuri Install Dependencies' from VS Code command (F1 / Cmd + P)";
      } else if (
        e?.message?.match(
          /The spec file already exists. Please specify --update or -u if you want to update the spec file./
        ) ||
        e?.message?.match(/ERROR!.*already exists\./)
      ) {
        message =
          'The spec file already exists. Please use SCuri Update if you want to update the spec file. Or SCuri Create Spec (overwrite) to overwrite the existing spec file with a fresh spec.';
      } else if (e?.message?.match(/A merge conflicted on path/)) {
        message = 'A merge conflicted on path';
      } else {
        console.log(
          `---------------- Could not run ${e?.cmd} ${EOL}------ with error: ${e?.message} ${EOL}${e?.stack && !e?.message.includes(e?.stack) ? '------  with stack' + e.stack : ''
          }`
        );
        message = 'Could not run Scuri command.';
      }

      window.showErrorMessage(message, 'ok', 'details').then((v) => {
        if (v === 'details') {
          channel.show();
        }
      });
      return message;
    });
}

function installDeps(channel: OutputChannel, context?: ExtensionContext) {
  if (context === null || context === undefined) {
    throw new Error('Context required');
  }

  // check the folder
  return window.withProgress(
    {
      location: ProgressLocation.SourceControl,
      title: 'Installing deps',
      cancellable: true,
    },
    (progress, token) => {
      token.onCancellationRequested(() => {
        console.log('------------User canceled the long running operation');
        progress.report({ message: 'Canceled!' });
      });

      return (
        // check/create if missing globalStorage/gparlakov.scuri-code
        mkDirIfNotExists(context.globalStoragePath, channel)
          // check create if missing globalStorage/gparlakov.scuri-code/deps
          .then(() => mkDirIfNotExists(depsPath, channel))
          // do not check if deps are installed because we might need to re-install (update!)
          .then(() => {
            token.onCancellationRequested(() => {
              console.log('------------User canceled the long running operation');
              progress.report({ message: 'Canceled!' });
            });

            const config = workspace.getConfiguration();
            const scuriVersion = config.get(scuriVersionConfig);
            const schematicsVersion = config.get(schematicsCliVersion)


            return new Promise((res, rej) => {
              const key_installing = 'scuri_deps_installing';
              if (context.globalState.get(key_installing)) {
                const message = `Trying to install dependencies multiple times simultaneously.`;
                console.error(message);
                rej(message);
              } else {
                context.globalState.update(key_installing, true);
              }

              channel.appendLine('Start installing deps. Could take a couple of minutes');
              channel.appendLine(`npm install scuri@${scuriVersion} @angular-devkit/schematics-cli@${schematicsVersion}`);

              const proc = c.exec(
                `npm i -S scuri@${scuriVersion} @angular-devkit/schematics-cli@${schematicsVersion} && echo installed > success.txt`,
                {
                  cwd: depsPath,
                  maxBuffer: 1000,
                }
              );

              proc.stdout.on('data', (d) => {
                log(typeof d === 'string' ? d : JSON.parse(d));
              });
              proc.stderr.on('data', (e) => {
                console.error(e);
                channel.appendLine(typeof e === 'string' ? e : JSON.parse(e));
              });

              proc.on('message', (m, s) => console.log(`---------- "npm i -S scuri@${scuriVersion} @angular-devkit/schematics-cli@${schematicsVersion} && echo installed > success.txt" message and success`, m, s))
              proc.on('exit', (code, signal) => {
                console.log(`------------ "npm i -S scuri@${scuriVersion} @angular-devkit/schematics-cli@${schematicsVersion} && echo installed > success.txt" exit with`, code, 'signal?', signal);
                // finished with installing deps
                context.globalState.update(key_installing, undefined);
                if (code === 0) {
                  channel.appendLine(`Successfully installed SCuri dependencies in ${depsPath}`);
                  res('Done');
                } else {
                  channel.appendLine('Failure installing deps');
                  rej('Error!');
                }
              });
            });
          })
          .catch((e) => {
            channel.appendLine(e.message);
            channel.appendLine(e.stack);
            if ('message' in e) {
              console.error(`${e.message} ${e.stack}`);
            } else {
              console.log(e);
            }
          })
      );
    }
  );
}

function takeAutospyArguments(context: ExtensionContext, channel: OutputChannel) {
  const quickPick = window.createQuickPick();
  quickPick.items = [
    { label: 'jest', description: 'Create auto-spy.ts for jest' },
    { label: 'jasmine', description: 'Create auto-spy.ts for jasmine' },
    {
      label: 'jest legacy ts',
      description: 'Create auto-spy.ts for jest and ts < 2.8 * no conditional types',
      detail: 'Choose this option if you are using TypeScript version less than 2.8',
    },
    {
      label: 'jasmine legacy ts',
      description: 'Create auto-spy.ts for jasmine and ts < 2.8 * no conditional types',
      detail: 'Choose this option if you are using TypeScript version less than 2.8',
    },
  ];
  let choice: 'jest' | 'jasmine' | 'jest legacy ts' | 'jasmine legacy ts';
  quickPick.onDidChangeSelection((selection) => {
    if (selection[0]) {
      choice = selection[0].label as 'jest' | 'jasmine' | 'jest legacy ts' | 'jasmine legacy ts';
    }
  });
  quickPick.onDidAccept(() => {
    if (Boolean(choice)) {
      quickPick.hide();

      let options: string;
      switch (choice) {
        case 'jest':
          options = '--for jest';
          break;
        case 'jasmine':
          options = '--for jasmine';
          break;
        case 'jest legacy ts':
          options = '--for jest --legacy';
          break;
        case 'jasmine legacy ts':
          options = '--for jasmine --legacy';
          break;
        default:
          warnMeCompileTimeIfIMissAValue(choice);
          options = '--for jest';
          break;
      }

      // create the command and run it immediately
      return scuriCommand(context, channel, runScuriSchematic, options, 'autospy')();
    }
  });
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
}

function areDepsInstalled() {
  return exists(join(depsPath, 'success.txt'));
}

function mkDirIfNotExists(path: string, channel: OutputChannel) {
  return exists(path).then((e) => {
    if (!e) {
      channel.appendLine(`${path} DOES NOT exist. Creating!`);
      console.log(`${path} DOES NOT exist. Creating!`);
      return mkdir(path)
        .then(() => console.log('------------created!'))
        .catch(e => console.error('could not create', e));
    } else {
      channel.appendLine(`${path} exist`);
      console.log(`${path} exist`);
      return undefined;
    }
  });
}

function warnMeCompileTimeIfIMissAValue(v: never) {
  throw new Error('You missed it!');
}

function wait(millis: number): Promise<void> {
  return new Promise((res) => setTimeout(res, millis));
}

async function mkLinkIfSrcNotExists(path: string, channel: OutputChannel) {
  return exists(`${path}/dist`)
    .then((scrExists) => {
      if (!scrExists) {
        log(`${scrExists} DOES NOT exist. linking with ${path}/src to support older versions of scuri!`);
        return symlink(`${path}/src`, `${path}/dist`, 'junction').then(() => {
          log('Link dist -> src successfully created.');
        })
      } else {
        log(`${path}/dist exist, proceed with using it`);
        return Promise.resolve();
      }
    });
}
