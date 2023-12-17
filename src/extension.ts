'use strict';

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { FolderProjectTreeProvider, Folder } from './projectExplorer';
import { PropertiesTreeProvider } from './itemsProperties';

// Create a webview panel for the properties
let propertiesPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const folderProjectTree = new FolderProjectTreeProvider();
    const treeView = vscode.window.createTreeView('codearchitect.view.project', { treeDataProvider: folderProjectTree });

    const yamlFilePath = path.join(context.extensionPath, 'config.yaml');
    const yamlStr = fs.readFileSync(yamlFilePath, 'utf8');
    const configs = yaml.load(yamlStr) as Array<{ type: string }>;
    const types = configs.map((config: any) => config.type);

    let lastClickedItem: Folder | undefined;

    // Update the calls to updateWebviewPanel
    treeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
        const folder = e.selection[0] as Folder;
        lastClickedItem = folder;
        updateWebviewPanel(lastClickedItem, configs, types, context);
    }
    });

    treeView.onDidCollapseElement(() => updateWebviewPanel(lastClickedItem, configs, types, context));
    treeView.onDidExpandElement(() => updateWebviewPanel(lastClickedItem, configs, types, context));

    const disposable = vscode.commands.registerCommand('codearchitect.project.addFolder', (folder: Folder) => {
        vscode.window.showInputBox({ prompt: 'Enter folder name' }).then(value => {
            if (value) {
                vscode.window.showQuickPick(types, { placeHolder: 'Select folder type' }).then(type => {
                    if (type) {
                        const newFolder = new Folder(value, vscode.TreeItemCollapsibleState.Collapsed);
                        newFolder.contextValue = "Folder." + type;
                        folderProjectTree.addItem(newFolder, folder);
                        treeView.reveal(newFolder, { select: false, focus: false, expand: true });
                    }
                });
            }
        });
    });

    const disposableRoot = vscode.commands.registerCommand('codearchitect.project.addRootFolder', () => {
        vscode.window.showInputBox({ prompt: 'Enter folder name' }).then(value => {
            if (value) {
                vscode.window.showQuickPick(types, { placeHolder: 'Select folder type' }).then(type => {
                    if (type) {
                        const newFolder = new Folder(value, vscode.TreeItemCollapsibleState.Collapsed);
                        newFolder.contextValue = "Folder." + type;
                        folderProjectTree.addItem(newFolder);
                    }
                });
            }
        });
    });

    context.subscriptions.push(disposable, disposableRoot);
}

function updateWebviewPanel(folder: Folder | undefined, configs: Array<{ type: string }>, types: string[], context: vscode.ExtensionContext): vscode.WebviewPanel | undefined {
    if (folder) {
        const type = folder.contextValue.split('.').pop();
        const config = configs.find(config => config.type === type);
        if (config && 'properties' in config) {
            if (!propertiesPanel) {
                propertiesPanel = vscode.window.createWebviewPanel(
                    'properties',
                    'Properties',
                    vscode.ViewColumn.Two,
                    {}
                );

                propertiesPanel.onDidDispose(() => {
                    propertiesPanel = undefined;
                });

                propertiesPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'navigate':
                                vscode.window.showQuickPick(types, { placeHolder: 'Select a type' }).then(type => {
                                    if (type) {
                                        propertiesPanel!.webview.postMessage({
                                            command: 'update',
                                            key: message.key,
                                            value: type
                                        });
                                    }
                                });
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );
            }

            propertiesPanel.webview.html = getWebviewContent(config.properties as { [key: string]: any; });
        } else {
            if (propertiesPanel) {
                propertiesPanel.webview.html = getWebviewContent({});
            }
        }
    }
    return propertiesPanel;
}

function getWebviewContent(properties: { [key: string]: any; }): string {
    let content = '<html><body>';

    for (const key in properties) {
        if (key === 'searchFields') {
            for (const searchField of properties[key]) {
                content += `<label for="${searchField.name}">${searchField.name}</label><br>`;
                content += `<input type="text" id="${searchField.name}" name="${searchField.name}" value="${searchField.value}">`;
                content += `<button onclick="navigate('${searchField.name}')">Navigate</button><br>`;
            }
        } else {
            content += `<label for="${key}">${key}</label><br>`;
            if (Array.isArray(properties[key])) {
                content += `<select id="${key}" name="${key}">`;
                for (const option of properties[key]) {
                    content += `<option value="${option}">${option}</option>`;
                }
                content += `</select><br>`;
            } else if (typeof properties[key] === 'boolean') {
                content += `<input type="checkbox" id="${key}" name="${key}" ${properties[key] ? 'checked' : ''}><br>`;
            } else {
                content += `<input type="text" id="${key}" name="${key}" value="${properties[key]}"><br>`;
            }
        }
    }
    

    content += `<script>
    console.log('script executed'); // Add this line
    const vscode = acquireVsCodeApi();

    function navigate(key) {
        console.log('navigate function called with key:', key);
        // Send a message to the extension
        vscode.postMessage({
            command: 'navigate',
            key: key
        });
        console.log('message posted to extension');
    }
</script>`;

    content += '</body></html>';

    return content;
}

export function deactivate() {}