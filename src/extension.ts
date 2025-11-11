import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { TypeResolver } from './TypeResolver';

async function getPythonPath(): Promise<string> {
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (pythonExtension) {
        try {
            await pythonExtension.activate();
            const executionDetails = pythonExtension.exports?.settings?.getExecutionDetails?.();
            if (executionDetails?.execCommand?.[0]) {
                return executionDetails.execCommand[0];
            }
            const pythonPath = pythonExtension.exports?.settings?.pythonPath;
            if (pythonPath) return pythonPath;
        } catch (e) {
            console.warn('[StructVisualizer] Failed to get Python path:', e);
        }
    }
    return process.platform === 'win32' ? 'python' : 'python3';
}

function createVisualizerPanel(context: vscode.ExtensionContext) {
    const configDir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, 'config.json');

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

    // Compute webview URIs for all JS modules
    const webviewPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'index.html');
    const mainJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'main.js'));
    const tabsJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'tabs.js'));
    const codeTabJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'codeTab.js'));
    const visualizerTabJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'visualizerTab.js'));
    const typesTabJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'typesTab.js'));
    const utilsJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'utils.js'));

    fs.readFile(webviewPath.fsPath, 'utf8', (err, data) => {
        if (err) {
            panel.webview.html = `<body>Error loading UI: ${err.message}</body>`;
            return;
        }
        const nonce = getNonce();
        const updatedHtml = data
            .replace(/\${nonce}/g, nonce)
            .replace(/\${mainJs}/g, mainJs.toString())
            .replace(/\${tabsJs}/g, tabsJs.toString())
            .replace(/\${codeTabJs}/g, codeTabJs.toString())
            .replace(/\${visualizerTabJs}/g, visualizerTabJs.toString())
            .replace(/\${typesTabJs}/g, typesTabJs.toString())
            .replace(/\${utilsJs}/g, utilsJs.toString());
        panel.webview.html = updatedHtml;
    });

    panel.webview.onDidReceiveMessage(async (message) => {
        const pythonPath = await getPythonPath();
        const env = { ...process.env };
        env.STRUCT_VISUALIZER_CONFIG = configPath;

        switch (message.command) {
            case 'runPython': {
                const { script, args } = message;
                const scriptPath = path.join(context.asAbsolutePath('python_backend'), script);
                const allArgs = [scriptPath, ...args];
                try {
                    const result = cp.spawnSync(pythonPath, allArgs, {
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

            case 'unknownType': {
                const { typeName, structUri, structLine } = message;
                if (!structUri || structLine === undefined) {
                    panel.webview.postMessage({ command: 'promptUnknownType', typeName });
                    return;
                }

                const resolver = new TypeResolver(context);
                const definition = await resolver.resolveType(
                    typeName,
                    vscode.Uri.parse(structUri),
                    new vscode.Position(structLine, 0)
                );

                if (definition) {
                    const saveScript = path.join(context.asAbsolutePath('python_backend'), 'save_type.py');
                    const saveArgs = [typeName, definition];
                    try {
                        const result = cp.spawnSync(pythonPath, [saveScript, ...saveArgs], {
                            encoding: 'utf-8',
                            timeout: 5000,
                            maxBuffer: 10 * 1024 * 1024,
                            env: env
                        });

                        if (result.status === 0) {
                            const output = JSON.parse(result.stdout);
                            if (output.success) {
                                panel.webview.postMessage({ command: 'retryVisualization' });
                                return;
                            }
                        }
                    } catch (e) {
                        console.error('Save type failed:', e);
                    }
                }

                panel.webview.postMessage({ command: 'promptUnknownType', typeName });
                break;
            }

            case 'saveManualType': {
                const { typeName, size, align } = message;
                const configPath = path.join(context.globalStorageUri.fsPath, 'config.json');
                let config: any = { types: {}, pointer: { size: 4, align: 4 }, gui: {} };
                try {
                    const raw = fs.readFileSync(configPath, 'utf8');
                    config = JSON.parse(raw);
                } catch (e) {
                    // Use default config if file missing or invalid
                }
                if (!config.types) config.types = {};
                config.types[typeName] = { size, align };
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                panel.webview.postMessage({ command: 'retryVisualization' });
                break;
            }

            case 'loadTypes': {
                const pythonPath = await getPythonPath();
                const env = { ...process.env };
                env.STRUCT_VISUALIZER_CONFIG = path.join(context.globalStorageUri.fsPath, 'config.json');
                const scriptPath = path.join(context.asAbsolutePath('python_backend'), 'load_types.py');
                const result = cp.spawnSync(pythonPath, [scriptPath], { 
                    encoding: 'utf8',
                    env: env 
                });
                if (result.status === 0) {
                    try {
                        const types = JSON.parse(result.stdout);
                        panel.webview.postMessage({ command: 'typesLoaded', types });
                    } catch (e) {
                        console.error('[StructVisualizer] Failed to parse types:', result.stdout);
                    }
                } else {
                    console.error('[StructVisualizer] load_types.py failed:', result.stderr || result.stdout);
                }
                break;
            }
            
            case 'addType':
            case 'updateType': {
                const { typeName, size, align } = message;
                const pythonPath = await getPythonPath();
                const env = { ...process.env };
                env.STRUCT_VISUALIZER_CONFIG = path.join(context.globalStorageUri.fsPath, 'config.json');
                const script = message.command === 'addType' ? 'add_type.py' : 'update_type.py';
                const scriptPath = path.join(context.asAbsolutePath('python_backend'), script);
                const result = cp.spawnSync(pythonPath, [scriptPath, typeName, size.toString(), align.toString()], { 
                    encoding: 'utf8',
                    env: env 
                });
                panel.webview.postMessage({
                    command: 'typeActionResult',
                    success: result.status === 0,
                    action: message.command.replace('Type', ''),
                    error: result.stderr || result.stdout
                });
                break;
            }
            
            case 'deleteType': {
                const { typeName } = message;
                const pythonPath = await getPythonPath();
                const env = { ...process.env };
                env.STRUCT_VISUALIZER_CONFIG = path.join(context.globalStorageUri.fsPath, 'config.json');
                const scriptPath = path.join(context.asAbsolutePath('python_backend'), 'delete_type.py');
                const result = cp.spawnSync(pythonPath, [scriptPath, typeName], { 
                    encoding: 'utf8',
                    env: env 
                });
                panel.webview.postMessage({
                    command: 'typeActionResult',
                    success: result.status === 0,
                    action: 'delete',
                    error: result.stderr || result.stdout
                });
                break;
            }
        }
    });

    return panel;
}

interface StructRange {
    code: string;
    startLine: number;
}

function extractStructAtPosition(text: string, cursorLine: number): StructRange | null {
    const lines = text.split('\n');
    if (cursorLine < 0 || cursorLine >= lines.length) return null;

    const structs: { start: number; braceOpen: number; braceClose: number; end: number }[] = [];
    let i = 0;

    while (i < lines.length) {
        const originalLine = lines[i];
        let line = originalLine.trim();
        if (line === '') { i++; continue; }
        if (line.startsWith('//')) { i++; continue; }

        if (/\b(?:typedef\s+)?struct\b/.test(line)) {
            const structStart = i;
            let braceOpen = -1;
            let braceClose = -1;
            let inBlockComment = false;
            let escaped = false;

            let j = i;
            while (j < lines.length) {
                const l = lines[j];
                for (let k = 0; k < l.length; k++) {
                    const char = l[k];
                    const next = k + 1 < l.length ? l[k + 1] : '';

                    if (escaped) { escaped = false; continue; }
                    if (char === '\\') { escaped = true; continue; }

                    if (!inBlockComment && char === '/' && next === '/') break;
                    if (!inBlockComment && char === '/' && next === '*') { inBlockComment = true; k++; continue; }
                    if (inBlockComment && char === '*' && next === '/') { inBlockComment = false; k++; continue; }
                    if (inBlockComment) continue;

                    if (char === '{') {
                        braceOpen = j;
                        break;
                    }
                }
                if (braceOpen !== -1) break;
                j++;
            }

            if (braceOpen === -1) { i++; continue; }

            let openBraces = 1;
            j = braceOpen;
            while (j < lines.length && openBraces > 0) {
                const l = lines[j];
                let startIdx = (j === braceOpen) ? l.indexOf('{') + 1 : 0;
                for (let k = startIdx; k < l.length; k++) {
                    const char = l[k];
                    const next = k + 1 < l.length ? l[k + 1] : '';

                    if (escaped) { escaped = false; continue; }
                    if (char === '\\') { escaped = true; continue; }

                    if (!inBlockComment && char === '/' && next === '/') break;
                    if (!inBlockComment && char === '/' && next === '*') { inBlockComment = true; k++; continue; }
                    if (inBlockComment && char === '*' && next === '/') { inBlockComment = false; k++; continue; }
                    if (inBlockComment) continue;

                    if (char === '{') openBraces++;
                    if (char === '}') openBraces--;
                    if (openBraces === 0) {
                        braceClose = j;
                        break;
                    }
                }
                if (openBraces === 0) break;
                j++;
            }

            if (braceClose === -1) { i++; continue; }

            let endLine = braceClose;
            while (endLine < lines.length) {
                if (lines[endLine].includes(';')) {
                    break;
                }
                endLine++;
            }

            structs.push({
                start: structStart,
                braceOpen,
                braceClose,
                end: endLine
            });

            i = endLine + 1;
        } else {
            i++;
        }
    }

    for (const s of structs) {
        if (cursorLine >= s.braceOpen && cursorLine <= s.braceClose) {
            const code = lines.slice(s.start, s.end + 1).join('\n');
            return { code, startLine: s.start };
        }
    }

    return null;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function activate(context: vscode.ExtensionContext) {
    let openCmd = vscode.commands.registerCommand('struct-visualizer.open', () => {
        createVisualizerPanel(context);
    });

    let fromEditorCmd = vscode.commands.registerCommand('struct-visualizer.visualizeFromEditor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        const langId = editor.document.languageId;
        if (langId !== 'c' && langId !== 'cpp') {
            vscode.window.showErrorMessage('StructVisualizer: Only available in C/C++ files.');
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        const fullText = document.getText();
        const structInfo = extractStructAtPosition(fullText, position.line);

        if (!structInfo) {
            vscode.window.showErrorMessage('No struct found at cursor. Place cursor inside a "struct" or "typedef struct" definition.');
            return;
        }

        const panel = createVisualizerPanel(context);
        setTimeout(() => {
            panel.webview.postMessage({
                command: 'preloadCode',
                code: structInfo.code,
                structUri: document.uri.toString(),
                structLine: structInfo.startLine
            });
        }, 300);
    });

    context.subscriptions.push(openCmd, fromEditorCmd);
    console.log('Global storage path:', context.globalStorageUri.fsPath);
}
