// visualizerTab.js
window.StructVisualizer.visualizerTab = {
    init() {
        const { byteWidthSlider, byteWidthValue } = window.StructVisualizer.elements;
        byteWidthSlider.addEventListener('input', () => {
            const value = byteWidthSlider.value;
            byteWidthValue.textContent = `${value} px`;
            if (window.StructVisualizer.lastLayout) {
                this.renderLayout(window.StructVisualizer.lastLayout, parseInt(value));
            }
        });
    },

    setStatus(message, isError = false) {
        window.StructVisualizer.utils.setStatus(message, isError);
    },

    handlePythonResult(output) {
        try {
            const layout = JSON.parse(output);
            if (layout.error) {
                this.setStatus(layout.error, true);
            } else if (layout.unknown_type) {
                window.StructVisualizer.utils.showTypePrompt(layout.unknown_type);
            } else {
                window.StructVisualizer.lastLayout = layout;
                window.StructVisualizer.tabs.switchTab('visualizer');
                this.renderLayout(layout, parseInt(window.StructVisualizer.elements.byteWidthSlider.value));
            }
        } catch (e) {
            this.setStatus('Invalid Python output', true);
        }
    },

    renderLayout(layout, byteWidth = 60) {
        const canvas = window.StructVisualizer.elements.visualizerCanvas;
        canvas.innerHTML = '';

        const scale = byteWidth;
        const rowBytes = layout.pack_value || layout.max_align;
        let html = '';

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

            let maxBitFields = 0;
            for (const field of layout.fields) {
                const fStart = field.offset;
                const fEnd = fStart + field.size;
                if (fStart < end && fEnd > start && field.bit_fields) {
                    maxBitFields = Math.max(maxBitFields, field.bit_fields.length);
                }
            }
            const rowHeight = Math.max(50, 50 + Math.max(0, maxBitFields - 1) * 14);

            html += `<div style="position:relative;height:${rowHeight}px;border:2px solid black;width:${rowWidth}px;margin-bottom:10px;">`;

            for (let i = start; i < end; i++) {
                if (i < 1000) {
                    html += `<div style="position:absolute;top:-24px;left:${(i - start) * scale}px;width:${scale}px;text-align:center;font-family:monospace;font-size:10px;color:blue;">${i}</div>`;
                }
            }

            html += `<div style="position:absolute;left:-30px;top:${rowHeight/2 - 8}px;font-family:monospace;font-size:12px;color:darkblue;">${start.toString().padStart(2, ' ')}</div>`;

            const items = [];

            for (const field of layout.fields) {
                const padStart = field.offset - field.padding_before;
                const padEnd = field.offset;
                if (padStart < end && padEnd > start) {
                    const ps = Math.max(padStart, start);
                    const pe = Math.min(padEnd, end);
                    if (pe > ps) {
                        items.push({ type: 'pad', start: ps, end: pe });
                    }
                }
            }

            for (const field of layout.fields) {
                const fStart = field.offset;
                const fEnd = fStart + field.size;
                if (fStart < end && fEnd > start) {
                    const fs = Math.max(fStart, start);
                    const fe = Math.min(fEnd, end);
                    if (fe > fs) {
                        items.push({ type: 'field', start: fs, end: fe, field: field });
                    }
                }
            }

            items.sort((a, b) => a.start - b.start);

            for (const item of items) {
                const x = (item.start - start) * scale;
                const w = (item.end - item.start) * scale;
                if (item.type === 'pad') {
                    html += `<div style="position:absolute;left:${x}px;top:0;height:${rowHeight}px;width:${w}px;background:#ff4d4d;opacity:0.7;"></div>`;
                    if (w > 30) {
                        html += `<div style="position:absolute;left:${x + w/2}px;top:${rowHeight/2 - 8}px;transform:translateX(-50%);color:white;font-family:monospace;font-size:10px;font-weight:bold;">PAD</div>`;
                    }
                } else {
                    const field = item.field;
                    let color = 'lightgreen';
                    if (field.type === 'function_ptr') color = 'plum';
                    else if (field.is_pointer) color = 'lightblue';

                    html += `<div style="position:absolute;left:${x}px;top:0;height:${rowHeight}px;width:${w}px;background:${color};border:2px solid black;"></div>`;

                    let label = field.name;
                    if (field.type === 'function_ptr') label += '_fn';
                    else if (field.is_pointer) label += '*';
                    if (field.is_array && field.count > 1) label += `[${field.count}]`;

                    if (w > 40) {
                        html += `<div style="position:absolute;left:${x + w/2}px;top:12px;transform:translateX(-50%);font-family:monospace;font-size:11px;font-weight:bold;">${label}</div>`;
                    }

                    if (field.bit_fields && field.bit_fields.length > 0) {
                        if (field.bit_fields.length === 1) {
                            const bitLabel = `${field.bit_fields[0].name}:${field.bit_fields[0].bits}b`;
                            if (w > 30) {
                                html += `<div style="position:absolute;left:${x + w/2}px;top:28px;transform:translateX(-50%);font-family:monospace;font-size:9px;">${bitLabel}</div>`;
                            }
                        } else if (w > 40) {
                            const startY = 28;
                            field.bit_fields.forEach((bit, idx) => {
                                const bitLabel = `${bit.name}:${bit.bits}b`;
                                const yPos = startY + idx * 14;
                                if (yPos + 10 < rowHeight) {
                                    html += `<div style="position:absolute;left:${x + 4}px;top:${yPos}px;font-family:monospace;font-size:9px;">${bitLabel}</div>`;
                                }
                            });
                        }
                    }
                }
            }

            html += `</div>`;
            byteOffset += rowBytes;
        }

        canvas.innerHTML = html;
        this.setStatus('Visualization complete.', false);
    }
};