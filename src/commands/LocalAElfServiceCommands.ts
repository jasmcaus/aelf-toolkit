import { window } from "vscode";
import { Constants } from "../Constants";
import { Output } from "../Output";
import { AElfService, LocalAElfNetService } from "../services";


export namespace LocalAElfServiceCommands {
    export async function start_local_aelf_network(): Promise<void> {
        try {
            AElfService.instantiate_instance(false)
            const aelf_process = await LocalAElfNetService.start_aelf_server();

            Output.output("LocalAElfServiceCommands", "Local AElf Server successfully started.")
            window.showInformationMessage("Local AElf Server successfully started.")
            if(!aelf_process.process) {
                // If server already running, don't do anything
                return
            }
        } catch(err) {
            // AElfService.undefine_instance()
            Output.output("LocalAElfServiceCommands", `Local AElf Server ERROR: ${(err as Error).toString()}`)
            window.showErrorMessage("Unable to start Local AElf Server. See output for more details.")
        }

        // const pty = new TerminalService("aelf-run-bp1", [""]);
        // const terminal = window.createTerminal({ name: "LocalInstance", pty });

        // const hasStarted: Promise<void> = new Promise((resolve) => {
        //     pty.onDidWrite((data) => {
        //         if(data.indexOf("I am running running") === -1) {
        //             AElfService.instantiate_instance(false)
        //             resolve()
        //         }
        //     })
        // })

        // terminal.show()

        // // Give the terminal a chance to get a lock on the blockchain before
        // // starting to do any offline commands.
        // await hasStarted
        //     .then(() => {
        //         AElfService.instantiate_instance(false)
        //         Output.output("LocalAElfServiceCommands", "Local AElf Server successfully started.")
        //         window.showInformationMessage("Local AElf Server successfully started.")
        //     })
        //     .catch((err) => {
        //         Output.output("LocalAElfServiceCommands", `Error: ${(err as Error).toString()}`)
        //         window.showErrorMessage("Unable to start local server. Please ensure that you followed the setup instructions carefully, and that `aelf-run-bp1` is a valid executable shell script added to PATH.")
        //     })
    }


    export async function stop_local_aelf_network(): Promise<void> {
        const port = Constants.default_port
        const port_status = await LocalAElfNetService.getPortStatus();

        if(port_status === LocalAElfNetService.PortStatus.AELF) {
            await LocalAElfNetService.stop_local_net(port);
        }
    }
}
