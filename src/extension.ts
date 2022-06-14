import { 
    commands, 
    ExtensionContext, 
    window 
} from "vscode"

import {
    LocalAElfServiceCommands,
    ProjectCommands,
 } from "./commands"

import { 
    CommandContext, 
    isWorkspaceOpen, 
    setCommandContext,
} from "./helpers"

import {
    LocalAElfNetService,
} from "./services"

import { Constants } from "./Constants"
import { Output } from "./Output"


export async function activate(context: ExtensionContext) {
    Constants.initialize(context)

    setCommandContext(CommandContext.Enabled, true)
    setCommandContext(CommandContext.IsWorkspaceOpen, isWorkspaceOpen())

    // Commands 
    const new_contract = commands.registerCommand("aelf-toolkit.new_contract", async() => {
        await try_execute(() => ProjectCommands.new_contract(context))
    })
    const create_wallet = commands.registerCommand("aelf-toolkit.create_wallet", async() => {
        await try_execute(() => ProjectCommands.create_wallet(context))
    })
    const transfer_assets = commands.registerCommand("aelf-toolkit.transfer_assets", async() => {
        await try_execute(() => ProjectCommands.transfer_assets(context))
    })
    const connect_to_instance = commands.registerCommand("aelf-toolkit.connect_to_instance", async() => {
        await try_execute(() => ProjectCommands.connect_to_aelf_node(context))
    })
    const stop_local_server = commands.registerCommand("aelf-toolkit.stop_local_server", async() => {
        await try_execute(() => LocalAElfServiceCommands.stop_local_aelf_network())
    })
    const deploy_contract = commands.registerCommand("aelf-toolkit.deploy_contract", async() => {
        await try_execute(() => ProjectCommands.deploy_contract(context))
    })
    const invoke_contract = commands.registerCommand("aelf-toolkit.invoke_contract", async() => {
        await try_execute(() => ProjectCommands.invoke(context))
    })
    const get_transaction_status = commands.registerCommand("aelf-toolkit.get_transaction_status", async() => {
        await try_execute(() => ProjectCommands.get_transaction_status(context))
    })

    
    const subscriptions = [
        new_contract,
        create_wallet,
        connect_to_instance,
        stop_local_server,
        transfer_assets,
        deploy_contract,
        invoke_contract,
        get_transaction_status,
    ]
    context.subscriptions.push(...subscriptions);
}


export async function deactivate(): Promise<void> {
    // This method is called when your extension is deactivated
    // To dispose of all extensions, vscode provides 5 sec.
    // Therefore, please, call important dispose functions first and don't use await
    // For more information see https://github.com/Microsoft/vscode/issues/47881
    try_execute(() => LocalAElfServiceCommands.stop_local_aelf_network())
    LocalAElfNetService.dispose();
    Output.dispose();
}


async function try_execute(
    func: () => Promise<any>, 
    err_msg: string | null = null
): Promise<void> {
    try {
        await func();
    } catch(error) {
        window.showErrorMessage(err_msg || (error as Error).message);
    }
}
