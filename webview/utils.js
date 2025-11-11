// utils.js
window.StructVisualizer.utils = {
    init() {
        // Set up global message listener
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'preloadCode') {
                window.StructVisualizer.codeTab.preloadCode(message.code);
                window.StructVisualizer.tabs.switchTab('code');
            } else if (message.command === 'pythonResult') {
                this.handlePythonResult(message.output);
            } else if (message.command === 'pythonError') {
                this.setStatus(`Python error: ${message.error}`, true);
            } else if (message.command === 'retryVisualization') {
                window.StructVisualizer.codeTab.visualize(false);
            } else if (message.command === 'typesLoaded') {
                window.StructVisualizer.typesTab.renderTypes(message.types);
            } else if (message.command === 'typeActionResult') {
                if (message.success) {
                    window.StructVisualizer.vscode.postMessage({ command: 'loadTypes' });
                } else {
                    this.setStatus('Action failed: ' + message.error, true);
                }
            }
        });
    },

    setStatus(message, isError = false) {
        const statusBar = window.StructVisualizer.elements.statusBar;
        statusBar.textContent = message;
        statusBar.style.color = isError ? '#d00' : '#007acc';
    },

    handlePythonResult(output) {
        try {
            const layout = JSON.parse(output);
            if (layout.error) {
                this.setStatus(layout.error, true);
            } else if (layout.unknown_type) {
                this.showTypePrompt(layout.unknown_type);
            } else {
                // Auto-refresh types if a struct was added to JSON
                if (layout.added_type) {
                    window.StructVisualizer.vscode.postMessage({ command: 'loadTypes' });
                    this.setStatus(`Struct '${layout.struct_name}' added to config.json`, false);
                }
                
                window.StructVisualizer.lastLayout = layout;
                window.StructVisualizer.tabs.switchTab('visualizer');
                window.StructVisualizer.visualizerTab.renderLayout(layout, parseInt(window.StructVisualizer.elements.byteWidthSlider.value));
            }
        } catch (e) {
            this.setStatus('Invalid Python output', true);
        }
    },

    showConfirmDialog(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
                <div style="background:white;padding:20px;border-radius:8px;max-width:400px;width:90%;">
                    <p>${message}</p>
                    <div>
                        <button id="confirm-yes" style="margin-right:10px;">Yes</button>
                        <button id="confirm-no">No</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('confirm-no').onclick = () => {
            document.body.removeChild(overlay);
        };

        document.getElementById('confirm-yes').onclick = () => {
            document.body.removeChild(overlay);
            onConfirm();
        };
    },

    showTypePrompt(typeName) {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
                <div style="background:white;padding:20px;border-radius:8px;max-width:400px;width:90%;">
                    <h3>Define Type: <code>${typeName}</code></h3>
                    <p>Type not found in project.</p>
                    <label>Size (bytes):</label>
                    <input type="number" id="prompt-size" value="1" min="1" style="width:100%;margin:5px 0;">
                    <label>Alignment (bytes):</label>
                    <input type="number" id="prompt-align" value="1" min="1" style="width:100%;margin:5px 0;">
                    <div style="margin-top:10px;">
                        <button id="prompt-save" style="margin-right:10px;">Add Type</button>
                        <button id="prompt-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('prompt-cancel').onclick = () => {
            document.body.removeChild(overlay);
            this.setStatus(`Type '${typeName}' not defined.`, true);
        };

        document.getElementById('prompt-save').onclick = () => {
            const size = document.getElementById('prompt-size').value;
            const align = document.getElementById('prompt-align').value;
            document.body.removeChild(overlay);
            window.StructVisualizer.vscode.postMessage({
                command: 'saveManualType',
                typeName,
                size: parseInt(size),
                align: parseInt(align)
            });
        };
    }
};