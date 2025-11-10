import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const configDir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, 'config.json');

    let disposable = vscode.commands.registerCommand('struct-visualizer.open', () => {
        const panel = vscode.window.createWebviewPanel(
            'structVisualizer',
            'StructVisualizer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview')
                ]
            }
        );

        const webviewPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'index.html');
        fs.readFile(webviewPath.fsPath, 'utf8', (err, data) => {
            if (err) {
                panel.webview.html = `<body>Error loading UI: ${err.message}</body>`;
                return;
            }
            const nonce = getNonce();
            const backendDir = context.asAbsolutePath('python_backend').replace(/\\/g, '/');
            const updatedHtml = data
                .replace(/\${webview.cspSource}/g, panel.webview.cspSource)
                .replace(/\${nonce}/g, nonce)
                .replace(/\${backendDir}/g, backendDir);
            panel.webview.html = updatedHtml;
        });

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'runPython':
                    const { script, args } = message;
                    const scriptPath = path.join(context.asAbsolutePath('python_backend'), script);
                    const allArgs = [scriptPath, ...args];

                    const env = { ...process.env };
                    env.STRUCT_VISUALIZER_CONFIG = configPath;

                    try {
                        const result = cp.spawnSync('python3', allArgs, {
                            encoding: 'utf-8',
                            timeout: 10000,
                            maxBuffer: 10 * 1024 * 1024,
                            env: env
                        });

                        if (result.error) {
                            panel.webview.postMessage({ command: 'pythonError', error: result.error.message });
                        } else if (result.status !== 0) {
                            panel.webview.postMessage({ command: 'pythonError', error: result.stderr || 'Python script failed' });
                        } else {
                            panel.webview.postMessage({ command: 'pythonResult', output: result.stdout });
                        }
                    } catch (e: any) {
                        panel.webview.postMessage({ command: 'pythonError', error: e.message });
                    }
                    break;
            }
        });
    });

    context.subscriptions.push(disposable);
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}