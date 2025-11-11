// codeTab.js
window.StructVisualizer.codeTab = {
    init() {
        const { visualizeBtn, loadExampleBtn, addToJsonBtn } = window.StructVisualizer.elements;
        visualizeBtn.addEventListener('click', () => this.visualize(false));
        loadExampleBtn.addEventListener('click', () => this.loadExample());
        addToJsonBtn.addEventListener('click', () => this.visualize(true));
    },

    loadExample() {
        const code = `struct DeviceConfig {
    uint8 enable    : 1;
    uint8 mode      : 3;
    uint8 priority  : 2;
    uint8 reserved  : 2;
    uint16 timeout  : 10;
    uint16 retries  : 6;
    uint32 data;
};`;
        window.StructVisualizer.elements.codeEditor.value = code;
    },

    preloadCode(code) {
        window.StructVisualizer.elements.codeEditor.value = code;
    },

    visualize(addToDb = false) {
        const code = window.StructVisualizer.elements.codeEditor.value;
        const packValue = window.StructVisualizer.elements.packInput.value.trim();
        const packArg = packValue === '' || packValue === '0' ? '0' : packValue;
        
        window.StructVisualizer.vscode.postMessage({
            command: 'runPython',
            script: 'main_wrapper.py',
            args: [code, packArg, addToDb ? '1' : '0']
        });
    }
};