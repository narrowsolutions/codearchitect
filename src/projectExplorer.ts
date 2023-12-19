import * as vscode from 'vscode';
import * as path from 'path';

export class Folder extends vscode.TreeItem {
    children: Folder[] = [];
    parent: Folder | null = null;

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly light_ico: string,
        public readonly dark_ico: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this.iconPath = {
            light: path.join(__filename, light_ico),
            dark: path.join(__filename, dark_ico)
        };
    }

    contextValue = 'Folder';
}

export class FolderProjectTreeProvider implements vscode.TreeDataProvider<Folder> {
    private _onDidChangeTreeData: vscode.EventEmitter<Folder | undefined | null | void> = new vscode.EventEmitter<Folder | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Folder | undefined | null | void> = this._onDidChangeTreeData.event;

    private items: Folder[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Folder): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Folder): Thenable<Folder[]> {
        if (element) {
            return Promise.resolve(element.children);
        } else {
            return Promise.resolve(this.items);
        }
    }

	getParent(element: Folder): vscode.ProviderResult<Folder> {
		return element.parent;
	}

    addItem(item: Folder, parent?: Folder): void {
        if (parent) {
            item.parent = parent;
            parent.children.push(item);
        } else {
            this.items.push(item);
        }
        this.refresh();
    }
}