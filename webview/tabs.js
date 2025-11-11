// tabs.js
window.StructVisualizer.tabs = {
    init() {
        const tabButtons = window.StructVisualizer.elements.tabButtons;
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    },

    switchTab(tabName) {
        const { tabButtons, tabContents } = window.StructVisualizer.elements;
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load types when opening Types tab
        if (tabName === 'types') {
            window.StructVisualizer.vscode.postMessage({ command: 'loadTypes' });
        }
    }
};