import * as vscode from 'vscode'

export async function activateIfNotActive() {
    const s = vscode.extensions.getExtension('gparlakov:scuri-code')
    if(s != null && !s.isActive) {
        await s.activate();
    }
} 