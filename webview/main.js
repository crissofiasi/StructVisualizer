// main.js
window.StructVisualizer = {
    vscode: acquireVsCodeApi(),
    currentTypes: {},
    lastLayout: null,
    elements: {
        // Will be populated after DOM load
    }
};

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements
    window.StructVisualizer.elements = {
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Code Tab
        codeEditor: document.getElementById('code-editor'),
        visualizeBtn: document.getElementById('visualize-btn'),
        loadExampleBtn: document.getElementById('load-example-btn'),
        addToJsonBtn: document.getElementById('add-to-json-btn'),
        
        // Visualizer Tab
        packInput: document.getElementById('pack-input'),
        byteWidthSlider: document.getElementById('byte-width'),
        byteWidthValue: document.getElementById('byte-width-value'),
        visualizerCanvas: document.getElementById('visualizer-canvas'),
        statusBar: document.getElementById('status-bar'),
        
        // Types Tab
        typesBody: document.getElementById('types-body'),
        typesAddBtn: document.getElementById('types-add'),
        typesEditBtn: document.getElementById('types-edit'),
        typesDeleteBtn: document.getElementById('types-delete')
    };

    // Initialize all modules
    window.StructVisualizer.tabs.init();
    window.StructVisualizer.codeTab.init();
    window.StructVisualizer.visualizerTab.init();
    window.StructVisualizer.typesTab.init();
    window.StructVisualizer.utils.init();

    // Load initial data
    window.StructVisualizer.vscode.postMessage({ command: 'loadTypes' });
    window.StructVisualizer.codeTab.loadExample();
});