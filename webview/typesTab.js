// typesTab.js
window.StructVisualizer.typesTab = {
    init() {
        const { typesAddBtn, typesEditBtn, typesDeleteBtn } = window.StructVisualizer.elements;
        typesAddBtn.addEventListener('click', () => this.showAddDialog());
        typesEditBtn.addEventListener('click', () => this.showEditDialog());
        typesDeleteBtn.addEventListener('click', () => this.showDeleteDialog());
    },

    renderTypes(types) {
        window.StructVisualizer.currentTypes = types;
        const tbody = window.StructVisualizer.elements.typesBody;
        tbody.innerHTML = '';
        for (const [name, info] of Object.entries(types)) {
            const row = tbody.insertRow();
            row.dataset.type = name;
            row.innerHTML = `<td>${name}</td><td>${info.size}</td><td>${info.align}</td>`;
            row.addEventListener('click', () => {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(r => r.style.backgroundColor = '');
                row.style.backgroundColor = '#e0e0e0';
            });
        }
    },

    getSelectedType() {
        const selected = window.StructVisualizer.elements.typesBody.querySelector('tr[style*="background"]');
        return selected ? selected.dataset.type : null;
    },

    showAddDialog() {
        this.showTypeDialog('Add Type');
    },

    showEditDialog() {
        const name = this.getSelectedType();
        if (!name) {
            window.StructVisualizer.utils.setStatus('Select a type to edit.', true);
            return;
        }
        const info = window.StructVisualizer.currentTypes[name];
        this.showTypeDialog('Edit Type', name, info.size, info.align, true);
    },

    showDeleteDialog() {
        const name = this.getSelectedType();
        if (!name) {
            window.StructVisualizer.utils.setStatus('Select a type to delete.', true);
            return;
        }
        window.StructVisualizer.utils.showConfirmDialog(
            `Delete type '${name}'?`,
            () => {
                window.StructVisualizer.vscode.postMessage({ command: 'deleteType', typeName: name });
            }
        );
    },

    showTypeDialog(title, typeName = '', size = 1, align = 1, isEdit = false) {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
                <div style="background:white;padding:20px;border-radius:8px;max-width:400px;width:90%;">
                    <h3>${title}</h3>
                    <label>Type Name:</label>
                    <input type="text" id="dialog-name" value="${typeName}" ${isEdit ? 'readonly' : ''} style="width:100%;margin:5px 0;">
                    <label>Size (bytes):</label>
                    <input type="number" id="dialog-size" value="${size}" min="1" style="width:100%;margin:5px 0;">
                    <label>Alignment (bytes):</label>
                    <input type="number" id="dialog-align" value="${align}" min="1" style="width:100%;margin:5px 0;">
                    <div style="margin-top:10px;">
                        <button id="dialog-save">Save</button>
                        <button id="dialog-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('dialog-cancel').onclick = () => {
            document.body.removeChild(overlay);
        };

        document.getElementById('dialog-save').onclick = () => {
            const name = document.getElementById('dialog-name').value.trim();
            const size = parseInt(document.getElementById('dialog-size').value);
            const align = parseInt(document.getElementById('dialog-align').value);
            document.body.removeChild(overlay);
            if (name && size > 0 && align > 0) {
                window.StructVisualizer.vscode.postMessage({
                    command: isEdit ? 'updateType' : 'addType',
                    typeName: name,
                    size,
                    align
                });
            }
        };
    }
};