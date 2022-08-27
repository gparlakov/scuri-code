import { execSync } from 'child_process';

export function getCurrentInstalledVersion(p: 'scuri' | '@angular-devkit/schematics-cli' = 'scuri') {
    return execSync(`cat $HOME/.config/Code/User/globalStorage/gparlakov.scuri-code/deps/node_modules/${p}/package.json | grep version`).toString('utf8');
}
