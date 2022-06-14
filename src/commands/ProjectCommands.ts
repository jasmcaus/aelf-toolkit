import fs from "fs-extra"
import path from "path"
import { ExtensionContext, Uri, workspace, window, tasks, QuickPickItem } from "vscode"
import { Constants } from "../Constants";
import { outputCommandHelper, get_workspace_root } from "../helpers";
import { Output } from "../Output";
import { AElfService } from "../services";
import { JSONC } from "../utils";
import { 
    copy_folders,
    recurse_through,
    delete_folder,
    delete_if_exists,
    get_posix_path, 
    show_ignorable_notification, 
    mkdir_if_not_exists,
    show_open_folder_dialog ,
    write_obj_to_file
} from "../utils/utils";
import { LocalAElfServiceCommands } from "./LocalAElfServiceCommands";


export namespace ProjectCommands {
    let NAME = "John"

    export async function new_contract(
        context: ExtensionContext
    ): Promise<void> {
        const root_folder = get_workspace_root()
        if(!root_folder) {
            throw new Error("Please open a folder in your VSCode workspace before creating a contract")
        }

        let contract_name = await window.showInputBox({
            placeHolder: "Enter a name for your Smart Contract (e.g AElf.Contract.TokenEscrow)"
        })

        while(!contract_name) {
            contract_name = await window.showInputBox({
                placeHolder: "Enter a valid name for your Smart Contract (e.g AElf.Contract.TokenEscrow)"
            })
        }

        console.debug("Initial contract name:", contract_name)
        contract_name = await parse_contract_name(contract_name)!
        if(!contract_name) {
            throw new Error("Something went wrong when parsing contract_name")
        }
        console.debug("Final contract name:", contract_name)

        const contract_path = get_posix_path(
            root_folder,
            "contracts",
            contract_name as string
        )

        console.debug("contract_path:", contract_path)

        if(fs.existsSync(contract_path)) {
            throw new Error(`A contract called ${contract_name} already exists in this workspace`)
        }

        await __create_project(contract_path, contract_name)
    }


    export async function create_wallet(
        context: ExtensionContext
    ) {
        let wallet_name = await window.showInputBox({
            placeHolder: "Enter a name for your wallet (e.g alice)"
        })
        while(!wallet_name) {
            wallet_name = await window.showInputBox({
                placeHolder: "Enter a valid name for your wallet (e.g alice)"
            })
        }

        let wallet_password = await window.showInputBox({
            placeHolder: `Enter a password for your wallet`,
            password: true
        })

        while(!wallet_password) {
            wallet_password = await window.showInputBox({
                placeHolder: "Enter a valid password for your wallet",
                password: true
            })
        }

        await AElfService.create_wallet(
            wallet_name,
            wallet_password
        )
    }


    export async function transfer_assets(
        context: ExtensionContext
    ) {
        const assets: QuickPickItem[] = [
            {
                label: "ELF",
                alwaysShow: true,
                description: "",
                detail: ""
            }
        ]
        const selected_asset = (await window.showQuickPick(
            assets,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose an asset to transfer"
            }
        ))!

        const wallets = get_wallets_for_quickpick()
        const from_wallets = wallets.from
        const to_wallets = wallets.to

        if(to_wallets.length === 0) {
            // No wallets
            throw new Error("You don't have any wallets. Try creating one before continuing")
        }

        const from_wallets_quickpick: QuickPickItem[] = []
        from_wallets.map((wallet: any) => {
            from_wallets_quickpick.push({
                label: wallet.name,
                detail: wallet.address,
                description: wallet.name.toLowerCase() === "genesis" ? "" : `${wallet.balance} ELF`
            })
        })

        const selected_from_wallet = (await window.showQuickPick(
            from_wallets_quickpick,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a wallet to transfer ELF from"
            }
        ))!

        const to_wallets_quickpick: QuickPickItem[] = []
        to_wallets.map((wallet: any) => {
            if(!(wallet.nickName === selected_from_wallet.label && 
                 wallet.address === selected_from_wallet.detail)) {
                to_wallets_quickpick.push({
                    label: wallet.name,
                    detail: wallet.address,
                    description: `${wallet.balance} ELF`
                })
            }
        })

        const selected_to_wallet = (await window.showQuickPick(
            to_wallets_quickpick,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a wallet to transfer ELF to"
            }
        ))!

        console.debug("Selected from wallet:", selected_from_wallet)
        console.debug("Selected to wallet:", selected_to_wallet)

        if(selected_from_wallet.label.toLowerCase() !== "genesis") {
            throw new Error("Transferring assets from a non-Genesis wallet to another is not supported as yet. Try funding your wallet from the Genesis account.")
        }

        // Select an amount
        let amount = +(await window.showInputBox({
            placeHolder: `Enter the amount of ELF to transfer to "${selected_to_wallet.label}"`
        }))!
        while(isNaN(amount)) {
            amount = +(await window.showInputBox({
                placeHolder: `Enter a valid amount of ELF to transfer to "${selected_to_wallet.label}"`
            }))!
        }

        const to_wallet = AElfService.get_wallet_from_nickname(selected_to_wallet.label).wallet

        let tx_id = ""
        await show_ignorable_notification(
            "Transferring assets",
            async () => {
                await new Promise((resolve: any) => {
                    setTimeout(() => {
                        resolve();
                    }, 3000)
                })

                const genesis_wallet = AElfService.get_genesis_wallet()

                // Approve Genesis to transfer some amount to user
                await AElfService.send(
                    "AElf.ContractNames.Token",
                    "Approve",
                    {
                        symbol: "ELF",
                        spender: genesis_wallet.address,
                        amount: Constants.format_elf(amount + 10)
                    },
                    genesis_wallet
                )

                // Transfer
                tx_id = await AElfService.send(
                    "AElf.ContractNames.Token",
                    "TransferFrom",
                    {
                        symbol: "ELF",
                        from: genesis_wallet.address,
                        to: to_wallet.address, // address
                        amount: Constants.format_elf(amount)
                    },
                    genesis_wallet
                )

                await new Promise((resolve: any) => {
                    setTimeout(() => {
                        resolve();
                    }, 4000)
                })
                
                console.debug("Finished sending ELF")
                const balance = await AElfService.get_balance(to_wallet)
            }
        )
        window.showInformationMessage(`Asset "ELF" transferred! Transaction id: ${tx_id}`)
    }


    export async function connect_to_aelf_node(
        context: ExtensionContext
    ) {
        const available_nodes: QuickPickItem[] = [
            {
                label: "AElf Mainchain",
                alwaysShow: true,
                detail: "This is expiremental and way work with unintended side-effects",
                description: ""
            },
            {
                label: "AElf TDVW Sidechain",
                alwaysShow: true,
                detail: "Doesn't launch a node on your machine; but will instead connect internally to the tdvw sidechain",
                description: ""
            },
            {
                label: "$(plus) Local AElf Node",
                alwaysShow: true,
                detail: "Launches a terminal with the node running in the background",
                description: ""
            },
        ]

        let selected_node
        selected_node = await window.showQuickPick(
            available_nodes,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a node to connect to"
            }
        )
        if(selected_node) {
            if(selected_node.label === "$(plus) Local AElf Node") {
                await LocalAElfServiceCommands.start_local_aelf_network()
            } else if(selected_node.label === "AElf TDVW Sidechain") {
                AElfService.instantiate_instance(true)
            } else {
                // For Mainchain, don't do anything just as yet
            }
        }
    }


    export async function deploy_contract(
        context: ExtensionContext
    ) {
        // Get all files in the workspace_root/contracts directory
        const files = recurse_through(path.join(
            get_workspace_root()!,
            "contracts"
        ))

        console.debug("Looking through ", path.join(
            get_workspace_root()!,
            "contracts"
        ))

        console.debug("Found files:", files)
        const deploy_ready_contracts: QuickPickItem[] = []
        files.map((file: string) => {
            if(file.endsWith(".dll.patched") && !file.includes("/test/")) {
                deploy_ready_contracts.push({
                    label: path.basename(file),
                    alwaysShow: true,
                    detail: file,
                    description: ""
                } )
            }
        })

        console.debug("Deployed Contracts found: ")
        let li = []
        for(const contract of deploy_ready_contracts) {
            li.push(contract.detail)
        }
        console.debug(li)

        if(deploy_ready_contracts.length === 0) {
            throw new Error("No compiled contracts were found in this workspace. A compiled contract (*.dll.patched) is required for deployment.")
        }
        
        const selected_contract_file_to_deploy = (await window.showQuickPick(
            deploy_ready_contracts,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a contract to deploy"
            }
        ))!

        const destinations: QuickPickItem[] = [
            {
                label: "Local Node",
                alwaysShow: true,
                description: "",
                detail: ""
            },
            {
                label: "Testnet",
                alwaysShow: true,
                description: "",
                detail: "Deploy to the tdvw sidechain"
            }
        ]

        const selected_destination = (await window.showQuickPick(
            destinations,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose where to deploy your contract"
            }
        ))?.label


        let contract_address = "" // DUMMY
        await show_ignorable_notification(
            `Deploying contract: ${selected_contract_file_to_deploy.label}`,
            async () => {
                const genesis_contract = await AElfService.get_genesis_contract()
                const genesis_contract_address = await AElfService.get_genesis_contract_address()
                const genesis_wallet = AElfService.get_genesis_wallet()

                // Propose new contract
                let propose_txid = ""
                try {
                    console.log("genesis_contract_address:", genesis_contract_address)
                    console.log("genesis_wallet:", genesis_wallet)

                    propose_txid = await AElfService.send(
                        genesis_contract_address,
                        "ProposeNewContract",
                        {
                            category: 0,
                            code: fs.readFileSync(selected_contract_file_to_deploy.detail!).toString("base64")
                        },
                        genesis_wallet
                    )
                } catch(err) {
                    console.trace(err)
                    throw new Error(`Error when proposing contract: ${(err as Error).toString()}`)
                }

                console.debug("PROPOSE_TXID:", propose_txid)
                if(!propose_txid) {
                    throw new Error("Proposal tx_id not found")
                }

                const propose_logs = await get_proper_tx_status(propose_txid)
                console.log("Propose logs:", propose_logs)

                let proposedContractInputHash = ""
                let proposalId = ""
                for(const log of propose_logs) {
                    if(log.Name === "ContractProposed") {
                        proposedContractInputHash = log.Result.proposedContractInputHash
                    }

                    if(log.Name === "ProposalCreated") {
                        proposalId = log.Result.proposalId
                    }
                }

                if(proposedContractInputHash === "") {
                    console.debug("proposedContractInputHash:", proposedContractInputHash)
                    throw new Error("Couldn't get proposedContractInputHash")
                }
                if(proposalId === "") {
                    console.debug("proposalId:", proposalId)
                    throw new Error("Couldn't get proposalId")
                }

                console.debug("ApproveMultiProposals: ================================================================")


                // Approve New Contract
                let approve_txid: any
                try {
                    approve_txid = await AElfService.send(
                        "AElf.ContractNames.Parliament",
                        "ApproveMultiProposals",
                        {
                            proposalIds: [
                                proposalId
                            ]
                        },
                        genesis_wallet
                    )
                    console.debug("APPROVE RESULT 11111:", approve_txid)
                } catch(err) {
                    throw new Error(`Error when approving contract: ${(err as Error).toString()}`)
                }
                console.debug("APPROVE RESULT 2222:", approve_txid)
                const approve_logs = await get_proper_tx_status(approve_txid)
                console.log("Approve logs:", approve_logs)


                // Release New Contract
                let release_txid: any
                try {
                    release_txid = await AElfService.send(
                        genesis_contract_address,
                        "ReleaseApprovedContract",
                        {
                            proposalId: proposalId,
                            proposedContractInputHash: proposedContractInputHash
                        },
                        genesis_wallet
                    )
                } catch(err) {
                    throw new Error(`Error when releasing contract: ${(err as Error).toString()}`)
                }
                console.debug("RELEASE TXID:", release_txid)
                const release_logs = await get_proper_tx_status(release_txid)
                console.log("Release logs:", release_logs)

                let new_proposalId = ""
                for(const log of release_logs) {
                    if(log.Name === "ProposalCreated") {
                        new_proposalId = log.Result.proposalId
                    }
                }

                console.debug("CODE CHECK ==============================================")

                await new Promise((resolve: any) => {
                    setTimeout(() => {
                        resolve();
                    }, 2000)
                })

                // CodeCheck
                let code_check_txid: any
                try {
                    code_check_txid = await AElfService.send(
                        genesis_contract_address,
                        "ReleaseCodeCheckedContract",
                        {
                            proposalId: new_proposalId,
                            proposedContractInputHash: proposedContractInputHash
                        },
                        genesis_wallet
                    )
                } catch(err) {
                    throw new Error(`Error when releasing contract: ${(err as Error).toString()}`)
                }
                const code_check_logs = await get_proper_tx_status(code_check_txid)
                console.log("Release logs:", code_check_logs)

                for(const log of code_check_logs) {
                    if(log.Name === "ContractDeployed") {
                        contract_address = log.Result.address
                    }
                }

                console.debug("Final contract address:", contract_address)
            }
        )
        
        // Add contract deploy
        const new_contract_obj = {
            "file": selected_contract_file_to_deploy.detail,
            "address": contract_address
        }
        mkdir_if_not_exists(Constants.deployed_contracts_folder)
        if(!fs.existsSync(Constants.deployed_contracts_json)) {
            // Write file
            const obj = {
                "contracts": [new_contract_obj]
            }
            write_obj_to_file(obj, Constants.deployed_contracts_json)
        } else {
            let obj = JSON.parse(fs.readFileSync(Constants.deployed_contracts_json).toString())
            obj.contracts.push(new_contract_obj)
            write_obj_to_file(obj, Constants.deployed_contracts_json)
        }

        console.debug("Written to ", Constants.deployed_contracts_json)

        window.showInformationMessage(`Contract deployed! Contract Address: ${contract_address}`)
    }


    export async function get_transaction_status(
        context: ExtensionContext
    ): Promise<{ result: any, is_mined: boolean }> {
        let tx_id = await window.showInputBox({
            placeHolder: "Enter a transaction id"
        })!
        while(!tx_id) {
            tx_id = await window.showInputBox({
                placeHolder: "Enter a transaction id"
            })!
        }

        const result = await AElfService.get_tx_result(tx_id)
        let is_mined: boolean = false 
        if(result.Status === "PENDING") {
            is_mined = false
        } else if(result.Status === "MINED") {
            is_mined = true
        } else {
            const msg = `Invalid status: ${result.Status}`
            console.error(msg)
            window.showErrorMessage(msg)
        }

        console.debug("Transaction status:", result)
        window.showInformationMessage(`Transaction Status:\n${JSON.stringify(result, null, 4)}`)

        return {
            result: result,
            is_mined: is_mined
        }
    }


    export async function invoke(
        context: ExtensionContext
    ) {
        if(!fs.existsSync(Constants.deployed_contracts_json)) {
            throw new Error(`No deployed contracts found. Hint: AElf Tookit looks at the "deployed-contracts/deployed-contracts.json" file. If this file doesn't exist (even if you've deployed a contract previously in this session, we won't be able to detect it)`)
        }

        const deployed_contracts = JSONC.parse(fs.readFileSync(Constants.deployed_contracts_json).toString())
        let deployed_contracts_quickpick: QuickPickItem[] = []
        for(const deployed_contract of deployed_contracts.contracts) {
            deployed_contracts_quickpick.push({
                label: deployed_contract.address,
                detail: path.basename(deployed_contract.file),
            } as QuickPickItem)
        }

        const selected_deployed_contract = await window.showQuickPick(
            deployed_contracts_quickpick,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a contract"
            }
        )

        const address = selected_deployed_contract?.label!
        const all_methods = await AElfService.get_fields(address)
        console.debug("All methods:", all_methods)
        if(all_methods.length === 0) {
            throw new Error(`No methods found for address: ${address}`)
        }
        
        remove_item(all_methods, "_chain")
        remove_item(all_methods, "address")
        remove_item(all_methods, "services")

        console.debug("All methods after splicing:", all_methods)

        let all_methods_quickpick: QuickPickItem[] = []
        for(const method of all_methods) {
            all_methods_quickpick.push({
                label: method,
                detail: get_view_if_applicable(method)
            } as QuickPickItem)
        }
        
        const selected_method = await window.showQuickPick(
            all_methods_quickpick,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a method to invoke"
            }
        )

        // Choose wallet
        const wallets = get_wallets_for_quickpick().from
        const wallets_quickpick: QuickPickItem[] = []
        wallets.map((wallet: any) => {
            wallets_quickpick.push({
                label: wallet.name,
                detail: wallet.address,
                description: wallet.name.toLowerCase() === "genesis" ? "" : `${wallet.balance} ELF`
            })
        })

        const selected_to_wallet = (await window.showQuickPick(
            wallets_quickpick,
            {
                ignoreFocusOut: true,
                placeHolder: "Choose a wallet to sign transaction with"
            }
        ))!

        const contract_details = await AElfService.get_contract_params(
            address,
            selected_method!.label,
            undefined, // we want to prompt the user for the params
            AElfService.get_genesis_wallet()
        )

        console.debug("CONTRACT_DETAILS PARAMS:", contract_details.params)

        let result: any
        let txid: string = ""
        if(selected_method!.detail?.toLowerCase() === "view method") {
            await show_ignorable_notification(
                `Call method ${selected_method!.label}`,
                async () => {
                    result = await contract_details.method.call(contract_details.params)
                }
            )
        } else {
            await show_ignorable_notification(
                "Executing transaction",
                async () => {
                    txid = (await contract_details.method(contract_details.params)).TransactionId
                    result = await get_proper_tx_status(txid)
                }
            )
        }

        console.debug("Result:", result)
        window.showInformationMessage(`Contract output: ${result}`)
    }
}


function get_wallets_for_quickpick() {
    const all_wallets = AElfService.get_wallets()
    let from_wallets: any[] = []
    let to_wallets: any[] = []

    all_wallets.map((wallet: any) => {
        const data = { 
            name: wallet.nickName, 
            address: wallet.address,
            balance: AElfService.is_on_testnet() ? wallet.tdvw_balance : wallet.local_balance
        }
        from_wallets.push(data)
        to_wallets.push(data)
    })

    // Add Genesis to `from_wallets`
    from_wallets.push({
        name: "Genesis",
        address: "DmjQGuGNcNQ55o5JNboWho6QvwynWnSt5njipvBeD3RNXxPoA"
    })

    return {
        from: from_wallets,
        to: to_wallets
    }
}


async function __create_project(
    contract_path: string,
    contract_name: string
): Promise<void> {
    let auto_run_task_labels: string[] = []
    const contract_path_dirname = path.dirname(contract_path)
    mkdir_if_not_exists(contract_path_dirname)

    await show_ignorable_notification(
        "Creating new Smart Contract",
        async () => {
            try {
                delete_if_exists(
                    path.join(contract_path_dirname, "generated"),
                    true
                )
                try {
                    await outputCommandHelper.execute(
                        contract_path_dirname,
                        "aelf",
                        "new",
                        contract_name as string,
                    )
                } catch(err) {
                    Output.output("__create_project", (err as Error).toString())
                    throw new Error("You do not have `aelf` installed, or it isn't accessible from a shell session. Please follow the setup instructions carefully")
                }

                // Delete Logs folder
                delete_folder(path.join(contract_path_dirname, "Logs"), false)

                fs.renameSync(
                    path.join(contract_path_dirname, "generated"),
                    contract_path
                )

                const split = contract_name.split(".")
                const contract_basename = `${split[split.length - 1]}Contract.cs`

                const file = get_posix_path(
                    contract_path,
                    "contract",
                    contract_name,
                    contract_basename
                )
                console.debug("Opening file:", file)
                
                // Open mainfile in editor
                await window.showTextDocument(
                    await workspace.openTextDocument(file)
                )

                const dot_vscode_folder_path = path.join(get_workspace_root()!, ".vscode")
                if(!fs.existsSync(dot_vscode_folder_path)) {
                    fs.mkdirsSync(dot_vscode_folder_path)
                }

                // Update/Add to settings.json
                const settings_path = get_posix_path(dot_vscode_folder_path, "settings.json")
                let settings_json: { [setting_name: string]: string } = {}
                try {
                    const settings_json_text = fs.readFileSync(settings_path).toString()
                    settings_json = JSONC.parse(settings_json_text)
                } catch { }

                for(const settings_name of Object.keys(Constants.settings_json_text)) {
                    settings_json[settings_name] = Constants.settings_json_text[settings_name]
                }

                fs.writeFileSync(
                    settings_path,
                    JSONC.stringify(settings_json)
                )


                // Add/Update tasks.json
                const tasks_json_path = get_posix_path(dot_vscode_folder_path, "tasks.json");
                let tasks_json: { version: string; tasks: any } = {
                    version: "2.0.0",
                    tasks: [],
                }

                try {
                    const tasks_json_txt = fs.readFileSync(tasks_json_path).toString()
                    tasks_json = JSONC.parse(tasks_json_txt);
                    if (!tasks_json.tasks || !Array.isArray(tasks_json.tasks)) {
                        tasks_json.tasks = [];
                    }
                } catch {}

                for (const task of Constants.tasks_json) {
                    const taskJson = {
                    options: {
                        cwd: task.cwd.replace("<CONTRACTNAME>", contract_name).replace("<CONTRACTNAME>", contract_name)
                    },
                    label: `${contract_name}: ${task.label}`,
                    command: task.command,
                    type: task.type,
                    args: task.args,
                    group: task.group,
                    presentation: { reveal: "silent" },
                    problemMatcher: task.problemMatcher,
                    dependsOn: task.dependsOnLabel
                        ? `${contract_name}: ${task.dependsOnLabel}`
                        : undefined,
                    };
                    (tasks_json.tasks as any[]).push(taskJson);
                    if (task.autoRun) {
                        auto_run_task_labels.push(taskJson.label);
                    }
                }
                fs.writeFileSync(
                    tasks_json_path, 
                    JSONC.stringify(tasks_json)
                )
            } catch (error) {
                delete_folder(contract_path, false)
                throw new Error(`Could not create project. '__create_project' failed: ${(error as Error).message}`)
            }
    })

    await show_ignorable_notification(
        "Running build tasks",
        async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const vscode_tasks = await tasks.fetchTasks();
                const build_tasks = vscode_tasks.filter(
                    (_) => auto_run_task_labels.indexOf(_.name) !== -1
                )
                for (const build_task of build_tasks) {
                    tasks.executeTask(build_task);
                }
            } catch(err) {
                throw new Error(`Failed to run tasks: ${(err as Error).toString()}`)
            }
        }
    )
}


async function get_proper_tx_status(
    tx_id: string, 
    should_delay: boolean = true
) {
    if(should_delay) {
        await new Promise((resolve: any) => {
            setTimeout(() => {
                resolve()
            }, 3000)
        })
    }
    console.log("get_proper_tx_status:", tx_id)
    let tx_status = await AElfService.get_tx_result(tx_id)
    console.debug("Tx Status:", tx_status)

    if(tx_status.Status === "PENDING") {
        // The tx should have already been mined by now, but wait two more seconds
        await new Promise((resolve: any) => {
            setTimeout(() => {
                resolve()
            }, 2000)
        })

        tx_status = await AElfService.get_tx_result(tx_id)
        if(tx_status.Status === "PENDING") {
            throw new Error("Your transaction still hasn't been mined after nearly 5 seconds. Please check if there's something wrong with your `AElfConfiguration` folder")
        }
    }

    if(tx_status.Status === "MINED") {
        // Decode transaction
        let logs = tx_status.Logs
        let deserialized_logs = await AElfService.deserialized_logs(tx_status.Logs)
        logs = logs.map((item: any, index: any) => ({
            ...item,
            Result: deserialized_logs![index]
        }))

        return logs
    } else {
        if(tx_status.Status === "NOTEXISTED") {
            throw new Error(`Transaction ${tx_id} does not exist. This is most likely an error with how your AElf Node is configured `)
        } else {
            throw new Error(`Transaction ${tx_id} still hasn't been mined for nearly 5s. Please check (and update accordingly your AElf Node configuration)`)
        }
    }
}


function get_view_if_applicable(method_name: string) {
    if(method_name.toLowerCase().startsWith("get")) {
        return "View Method"
    }
    return ""
}

async function parse_contract_name(contract_name: string): Promise<string | undefined> {
    if (!contract_name) {
        return undefined;
    }

    if (!contract_name[0].match(/[a-z]/i)) {
        contract_name = "_" + contract_name;
    }

    return contract_name.replace(/[^a-z0-9.]+/gi, "_") || undefined;
}


function remove_item(fields: string[], value: string) {
    const index = fields.indexOf(value)
    if(index > -1) {
        fields.splice(index, 1)
    }
    return fields
}