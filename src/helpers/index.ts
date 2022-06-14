import * as outputCommandHelper from "./command";
import * as commandContext from "./commandContext";
import * as shell from "./shell";
import * as vscodeEnvironment from "./vscodeEnvironment";
import * as workspaceHelpers from "./workspace";

const spawnProcess = outputCommandHelper.spawnProcess;
const get_workspace_root = workspaceHelpers.get_workspace_root;
const isWorkspaceOpen = workspaceHelpers.isWorkspaceOpen;
const CommandContext = commandContext.CommandContext;
const setCommandContext = commandContext.setCommandContext;

export {
    CommandContext,
    get_workspace_root,
    isWorkspaceOpen,
    outputCommandHelper,
    setCommandContext,
    shell,
    spawnProcess,
    vscodeEnvironment
};
