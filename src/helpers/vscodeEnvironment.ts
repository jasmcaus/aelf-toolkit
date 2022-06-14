
import vscode from "vscode";

export async function writeToClipboard(text: string): Promise<void> {
  return vscode.env.clipboard.writeText(text);
}
