
import { commands } from "vscode";

export enum VSCommands {
  SetContext = "setContext",
}

export enum CommandContext {
  Enabled = "mjolnir:enabled",
  IsGanacheRunning = "mjolnir:isGanacheRunning",
  IsWorkspaceOpen = "mjolnir:isWorkspaceOpen",
}

export function setCommandContext(key: CommandContext | string, value: boolean): Thenable<boolean | undefined> {
  return commands.executeCommand<boolean>(VSCommands.SetContext, key, value);
}
