
import { workspace } from "vscode";

export function get_workspace_root(ignoreException: boolean = false): string | undefined {
  const workspaceRoot = workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath;

  if(workspaceRoot === undefined && !ignoreException) {
    return undefined
  }

  return workspaceRoot;
}

export function isWorkspaceOpen(): boolean {
  return !!(workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath);
}
