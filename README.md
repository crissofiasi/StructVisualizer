# StructVisualizer

Parse and visualize C/C++ struct memory layout with alignment, padding, pointers, and packing control.

## Features

- **Right-click any struct** in a C/C++ file → **“Visualize Struct”**
- **Memory layout visualization**:
  - 8-byte rows (configurable via packing)
  - Color-coded fields:
    - 🟢 Light green: normal data
    - 🔵 Light blue: pointers
    - 🟣 Plum: function pointers
    - 🔴 Red ("PAD"): padding bytes
- **Bit-field support** with vertical label stacking
- **Byte-width slider** for zoom control
- **Automatic type resolution** using VS Code’s C/C++ extension (cpptools)
- **User-configurable exclusion paths** to avoid build/backup files
- **Manual type definition** fallback for unresolved types
- **“Add Struct to JSON”** to save computed size/alignment

## Requirements

- VS Code
- [C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) (for type resolution)

## Usage

1. Open a `.c` or `.h` file
2. Place cursor **inside a `struct` or `typedef struct`**
3. Right-click → **“Visualize Struct”**
4. Adjust packing or zoom as needed

## Settings

- `struct-visualizer.typeResolver.excludePaths`:  
  Array of globs to exclude when resolving types (e.g., `["**/build/**", "**/*.bak"]`)

---

Built for embedded and systems developers who need to verify struct memory layout.