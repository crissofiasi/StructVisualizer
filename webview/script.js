(function () {
    const vscode = acquireVsCodeApi();

    const codeEditor = document.getElementById('code-editor');
    const packInput = document.getElementById('pack-input');
    const visualizeBtn = document.getElementById('visualize-btn');
    const loadExampleBtn = document.getElementById('load-example-btn');
    const addToJsonBtn = document.getElementById('add-to-json-btn');
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const statusBar = document.getElementById('status-bar');

    function setStatus(message, isError = false) {
        statusBar.textContent = message;
        statusBar.style.color = isError ? '#d00' : '#007acc';
    }

    function loadExample() {
        codeEditor.value = `struct DeviceConfig {
    uint8 enable    : 1;
    uint8 mode      : 3;
    uint8 priority  : 2;
    uint8 reserved  : 2;
    uint16 timeout  : 10;
    uint16 retries  : 6;
    uint32 data;
};`;
    }

    function runPythonScript(script, args) {
        return new Promise((resolve, reject) => {
            const callback = (event) => {
                const message = event.data;
                if (message.command === 'pythonResult') {
                    window.removeEventListener('message', callback);
                    resolve(message.output);
                } else if (message.command === 'pythonError') {
                    window.removeEventListener('message', callback);
                    reject(message.error);
                }
            };
            window.addEventListener('message', callback);
            vscode.postMessage({ command: 'runPython', script, args });
        });
    }

    async function visualize(addToDb = false) {
        const code = codeEditor.value;
        const packValue = packInput.value.trim();
        const packArg = packValue === '' || packValue === '0' ? '0' : packValue;

        setStatus('Processing...', false);

        try {
            const args = [code, packArg, addToDb ? '1' : '0'];
            const result = await runPythonScript('main_wrapper.py', args);
            const layout = JSON.parse(result);

            if (layout.error) {
                setStatus(layout.error, true);
                visualizerCanvas.innerHTML = '';
            } else if (layout.unknown_type) {
                // In full version, show prompt — for now, error
                setStatus(`Unknown type: ${layout.unknown_type}`, true);
            } else {
                renderLayout(layout);
                if (addToDb) {
                    alert(`Struct '${layout.struct_name}' added to config.json`);
                }
            }
        } catch (err) {
            setStatus(`Python error: ${err}`, true);
        }
    }

    function renderLayout(layout) {
        const canvas = visualizerCanvas;
        canvas.innerHTML = '';

        const scale = 60; // px per byte (will be configurable later)
        const rowBytes = layout.pack_value || layout.max_align;
        let html = '';

        // Stats
        const dataBytes = layout.fields.reduce((sum, f) => sum + f.size, 0);
        const padBytes = layout.total_size - dataBytes;
        const efficiency = layout.total_size ? ((dataBytes / layout.total_size) * 100).toFixed(1) : '0.0';
        const color = efficiency >= 70 ? 'black' : 'red';
        html += `<div style="font-family:monospace;font-weight:bold;color:${color};margin-bottom:8px;">
            Size: ${layout.total_size} B | Data: ${dataBytes} B | Pad: ${padBytes} B | Eff: ${efficiency}%
        </div>`;
        html += `<div style="font-family:monospace;font-weight:bold;margin-bottom:12px;">
            ${layout.pack_value ? `Packed: ${layout.pack_value} B` : `Natural (max align ${layout.max_align} B)`}
        </div>`;

        let byteOffset = 0;
        while (byteOffset < layout.total_size) {
            const start = byteOffset;
            const end = Math.min(byteOffset + rowBytes, layout.total_size);
            const rowWidth = (end - start) * scale;

            html += `<div style="position:relative;height:50px;border:2px solid black;width:${rowWidth}px;margin-bottom:10px;">`;

            // Byte numbers (top)
            for (let i = start; i < end; i++) {
                if (i < 1000) {
                    html += `<div style="position:absolute;top:-16px;left:${(i - start) * scale + scale/2}px;transform:translateX(-50%);font-family:monospace;font-size:10px;color:blue;">${i}</div>`;
                }
            }

            // Row label (left)
            html += `<div style="position:absolute;left:-30px;top:15px;font-family:monospace;font-size:12px;color:darkblue;">${start.toString().padStart(2, ' ')}</div>`;

            // Padding and fields
            const items = [];

            // Add padding segments
            for (const field of layout.fields) {
                const padStart = field.offset - field.padding_before;
                const padEnd = field.offset;
                if (padStart < end && padEnd > start) {
                    const ps = Math.max(padStart, start);
                    const pe = Math.min(padEnd, end);
                    if (pe > ps) {
                        items.push({
                            type: 'pad',
                            start: ps,
                            end: pe
                        });
                    }
                }
            }

            // Add field segments
            for (const field of layout.fields) {
                const fStart = field.offset;
                const fEnd = fStart + field.size;
                if (fStart < end && fEnd > start) {
                    const fs = Math.max(fStart, start);
                    const fe = Math.min(fEnd, end);
                    if (fe > fs) {
                        items.push({
                            type: 'field',
                            start: fs,
                            end: fe,
                            field: field
                        });
                    }
                }
            }

            // Sort by start
            items.sort((a, b) => a.start - b.start);

            for (const item of items) {
                const x = (item.start - start) * scale;
                const w = (item.end - item.start) * scale;
                if (item.type === 'pad') {
                    html += `<div style="position:absolute;left:${x}px;top:0;height:50px;width:${w}px;background:#ff4d4d;opacity:0.7;"></div>`;
                    if (w > 30) {
                        html += `<div style="position:absolute;left:${x + w/2}px;top:15px;transform:translateX(-50%);color:white;font-family:monospace;font-size:10px;font-weight:bold;">PAD</div>`;
                    }
                } else {
                    const field = item.field;
                    let color = 'lightgreen';
                    if (field.type === 'function_ptr') color = 'plum';
                    else if (field.is_pointer) color = 'lightblue';

                    html += `<div style="position:absolute;left:${x}px;top:0;height:50px;width:${w}px;background:${color};border:2px solid black;"></div>`;

                    let label = field.name;
                    if (field.type === 'function_ptr') label += '_fn';
                    else if (field.is_pointer) label += '*';
                    if (field.is_array && field.count > 1) label += `[${field.count}]`;

                    if (w > 40) {
                        html += `<div style="position:absolute;left:${x + w/2}px;top:15px;transform:translateX(-50%);font-family:monospace;font-size:11px;font-weight:bold;">${label}</div>`;
                    }

                    // Bit-fields (simplified)
                    if (field.bit_fields && w > 20) {
                        const bitLabels = field.bit_fields.map(b => `${b.name}:${b.bits}b`).join(' | ');
                        if (w > 60) {
                            html += `<div style="position:absolute;left:${x + w/2}px;top:30px;transform:translateX(-50%);font-family:monospace;font-size:9px;">${bitLabels}</div>`;
                        }
                    }
                }
            }

            html += `</div>`;
            byteOffset += rowBytes;
        }

        canvas.innerHTML = html;
        setStatus('Visualization complete.', false);
    }

    // Event listeners
    visualizeBtn.addEventListener('click', () => visualize(false));
    loadExampleBtn.addEventListener('click', loadExample);
    addToJsonBtn.addEventListener('click', () => visualize(true));

    loadExample();
})();