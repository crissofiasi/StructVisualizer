// src/TypeResolver.ts

import * as vscode from 'vscode';

/**
 * Resolves C/C++ type definitions using the Microsoft C/C++ extension (cpptools).
 * Supports user-defined exclusion patterns to avoid backup/build artifacts.
 */
export class TypeResolver {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Attempts to resolve a type name to its full definition text.
     * 
     * @param typeName The name of the type to resolve (e.g., "BackLightInstance_Type")
     * @param sourceUri URI of the file where the type is used
     * @param sourcePosition A Position within the source file (used by cpptools)
     * @returns The full definition text of the type, or null if not found or excluded
     */
    async resolveType(
        typeName: string,
        sourceUri: vscode.Uri,
        sourcePosition: vscode.Position  // ← Must be Position, not Range
    ): Promise<string | null> {
        try {
            // Request definition locations from cpptools
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                sourceUri,
                sourcePosition  // ← cpptools expects a Position
            );

            if (!locations || locations.length === 0) {
                return null;
            }

            // Get user-defined exclusion patterns from settings
            const excludePatterns = vscode.workspace.getConfiguration('struct-visualizer').get<string[]>(
                'typeResolver.excludePaths',
                []
            );

            // Filter out excluded paths
            const validLocations = locations.filter(loc => {
                const locPath = loc.uri.fsPath;
                return !excludePatterns.some(pattern => {
                    return this.matchGlob(locPath, pattern);
                });
            });

            if (validLocations.length === 0) {
                return null;
            }

            // Handle ambiguity: use first match but log warning
            if (validLocations.length > 1) {
                const paths = validLocations.map(loc => loc.uri.fsPath);
                console.warn(
                    `[StructVisualizer] Type '${typeName}' resolved to ${validLocations.length} files:`,
                    paths
                );
            }

            // Read the definition text from the first valid location
            const loc = validLocations[0];
            const doc = await vscode.workspace.openTextDocument(loc.uri);
            const definitionText = doc.getText(loc.range);

            return definitionText;

        } catch (error) {
            console.error(`[StructVisualizer] Failed to resolve type '${typeName}':`, error);
            return null;
        }
    }

    /**
     * Matches a file path against a glob pattern.
     * Supports:
     * - '*'  → matches any characters except path separators
     * - '**' → matches any characters including path separators
     */
    private matchGlob(filePath: string, pattern: string): boolean {
        // Normalize for cross-platform consistency
        const isWin = process.platform === 'win32';
        let normalizedPath = isWin ? filePath.replace(/\\/g, '/') : filePath;
        let normalizedPattern = isWin ? pattern.replace(/\\/g, '/') : pattern;

        // Escape regex special characters, then replace globs
        normalizedPattern = normalizedPattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex metacharacters
            .replace(/\*\*/g, '.*')             // ** → match anything (including /)
            .replace(/\*/g, '[^/]*');           // * → match non-slash chars

        const regex = new RegExp(`^${normalizedPattern}$`);
        return regex.test(normalizedPath);
    }
}