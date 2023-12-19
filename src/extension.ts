'use strict';

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { FolderProjectTreeProvider, Folder } from './projectExplorer';

// Create a webview panel for the properties
let propertiesPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const folderProjectTree = new FolderProjectTreeProvider();
    const treeView = vscode.window.createTreeView('codearchitect.view.project', { treeDataProvider: folderProjectTree });

    const yamlFilePath = path.join(context.extensionPath, 'config.yaml');
    const yamlStr = fs.readFileSync(yamlFilePath, 'utf8');
    const configs = yaml.load(yamlStr) as Array<{ type: string, name: string, description: string, light_ico: string, dark_ico: string, children?: Array<{ name: string }> }>;
    const names = configs.map((config: any) => config.name);

    let lastClickedItem: Folder | undefined;

    // Update the calls to updateWebviewPanel
    treeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
        const folder = e.selection[0] as Folder;
        lastClickedItem = folder;
        updateWebviewPanel(lastClickedItem, configs, names, context);
    }
    });

    treeView.onDidCollapseElement(() => updateWebviewPanel(lastClickedItem, configs, names, context));
    treeView.onDidExpandElement(() => updateWebviewPanel(lastClickedItem, configs, names, context));

    const disposable = vscode.commands.registerCommand('codearchitect.project.addFolder', async (folder: Folder) => {
      const currentFolder = folder.contextValue.split('.').pop(); 
      const currentConfig = configs.find(config => config.name === currentFolder);
      const availableChildren = (currentConfig && currentConfig.children) || [];
      const filteredNames = names.filter(name => availableChildren.includes(name));
      const selectedName = await vscode.window.showQuickPick(filteredNames, { placeHolder: 'Select folder type' });
  
      if (selectedName) {
          const config = configs.find(config => config.name === selectedName);
          if (config) {
              const { name, description, light_ico, dark_ico } = config;
              const value = await vscode.window.showInputBox({ prompt: 'Enter folder name' });
  
              if (value) {
                  const newFolder = new Folder(value, description, vscode.TreeItemCollapsibleState.Collapsed, light_ico, dark_ico);
                  newFolder.contextValue = "Folder." + name;
                  folderProjectTree.addItem(newFolder, folder);
                  treeView.reveal(newFolder, { select: false, focus: false, expand: true });
              }
          }
      }
  });

    const disposableRoot = vscode.commands.registerCommand('codearchitect.project.addRootFolder', () => {
      const name = configs.find(config => config.name === 'Project')!.name;
      const description = configs.find(config => config.name === 'Project')!.description;
      const light_ico = configs.find(config => config.name === 'Project')!.light_ico;
      const dark_ico = configs.find(config => config.name === 'Project')!.dark_ico;
      vscode.window.showInputBox({ prompt: 'Set Project Name' }).then(value => {
          if (value) {
              const newFolder = new Folder(value, description, vscode.TreeItemCollapsibleState.Collapsed, light_ico, dark_ico);
              newFolder.contextValue = "Folder." + name;
              folderProjectTree.addItem(newFolder);
          } 
      });
    });

    context.subscriptions.push(disposable, disposableRoot);
}

function updateWebviewPanel(folder: Folder | undefined, configs: Array<{ name: string }>, types: string[], context: vscode.ExtensionContext): vscode.WebviewPanel | undefined {
    if (folder) {
        const name = folder.contextValue.split('.').pop();
        const config = configs.find(config => config.name === name);
        if (config && 'properties' in config) {
            if (!propertiesPanel) {
                propertiesPanel = vscode.window.createWebviewPanel(
                    'properties',
                    'Properties',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true
                    }
                );

                propertiesPanel.onDidDispose(() => {
                    propertiesPanel = undefined;
                });

                // Add the message handling for the search command inside the newly created panel
                // Update the message handling within the extension
                propertiesPanel.webview.onDidReceiveMessage(message => {
                  console.log("Received message: " + message.command)
                  if (message.command === 'search') {
                      // Handle the 'search' command from the webview
                      vscode.window.showQuickPick(['Item 1', 'Item 2', 'Item 3']).then(selection => {
                          if (selection) {
                              vscode.window.showInformationMessage(`Selected: ${selection}`);
                          }
                      });
                  }
                }, undefined, context.subscriptions);
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
    //check if one of the fields of properties[key] is an object
    if (typeof properties[key] === 'object') {
      //check if field type is in properties[key]
      if ('type' in properties[key]) {
        //check if field type is a select
        if (properties[key].type === 'input') {
          content += `<label for="${key}">${key}</label><br>`;
          content += `<input type="text" id="${key}" name="${key}" value="${properties[key].value}"><br>`;
        }
        else if (properties[key].type === 'dropdown') {
          content += `<label for="${key}">${key}</label><br>`;
          content += `<select id="${key}" name="${key}">`;
          for (const option of properties[key].value) {
            content += `<option value="${option}">${option}</option>`;
          }
          content += `</select><br>`;
        }
        else if (properties[key].type === 'checkbox') {
          content += `<label for="${key}">${key}</label><br>`;
          content += `<input type="checkbox" id="${key}" name="${key}" ${properties[key].value ? 'checked' : ''}><br>`;
        }
        else if (properties[key].type === 'nav') {
          content += `<label for="${key}">${key}</label><br>`;
          //Create a input field that cannot be edited by the user and a search icon on the right
          content += `<input type="text" id="${key}" name="${key}" value="${properties[key].value}" readonly>`;
          content += `<button type="button" id="searchButton_${key}">Search</button><br>`;
        }
        else {
          content += `<label for="${key}">${key}</label><br>`;
        }
      }
    }
  }

  // After the for loop inside the getWebviewContent function
  content += `<script>
  const vscode = acquireVsCodeApi();
  const buttons = document.querySelectorAll('[id^="searchButton_"]');
  buttons.forEach(button => {
    button.addEventListener('click', event => {
        const buttonId = event.target.id.split('_').pop();
        vscode.postMessage({ command: 'search', key: buttonId });
    });
  });
  </script>`;

  content += '</body></html>';

  return content;
}

export function deactivate() {}