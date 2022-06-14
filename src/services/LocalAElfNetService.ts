
import { ChildProcess } from "child_process";
import { OutputChannel, window } from "vscode";
import { Constants, RequiredApps } from "../Constants";
import { shell, spawnProcess } from "../helpers";
import { findPid, killPid } from "../helpers/shell";
import { AElfService } from "./AElfService";


export namespace LocalAElfNetService {
    const __port = Constants.port

    export interface IGanacheProcess {
        output?: OutputChannel;
        pid?: number;
        port: number;
        process?: ChildProcess;
    }

    export const aelf_processes: {[port: string]: IGanacheProcess} = {};

    export enum PortStatus {
        FREE = 0,
        AELF = 1,
        NOT_AELF = 2,
    }

    export async function getPortStatus(): Promise<PortStatus> {
        if(!isNaN(await shell.findPid(__port))) {
            if(await is_local_aelf()) {
                return PortStatus.AELF
            } 
            return PortStatus.NOT_AELF
        }

        return PortStatus.FREE;
    }


    export async function start_aelf_server(): Promise<IGanacheProcess> {
        const portStatus = await getPortStatus();
        if(portStatus === PortStatus.NOT_AELF) {
            throw new Error(`Unable to start. Port ${__port} is busy.`);
        }

        if(portStatus === PortStatus.AELF) {
            const pid = await findPid(__port);
            aelf_processes[__port] = { pid, port: __port }
        }

        if(portStatus === PortStatus.FREE) {
            aelf_processes[__port] = await spawn_local_aelf_network(__port);
        }

        return aelf_processes[__port];
    }


    export async function stop_local_net(port: number | string, kill_out_of_band: boolean = true): Promise<void> {
        return stop_local_process(aelf_processes[port], kill_out_of_band);
    }


    export function getPortFromUrl(url: string): string {
        const result = url.match(/(:\d{2,4})/);
        return result ? result[0].slice(1) : Constants.defaultLocalhostPort.toString();
    }


    export async function dispose(): Promise<void> {
        const should_be_free = Object.values(aelf_processes).map((aelf_process) =>
            stop_local_process(aelf_process, false)
        );
        return Promise.all(should_be_free).then(() => undefined);
    }


    async function spawn_local_aelf_network(port: number | string): Promise<IGanacheProcess> {
        const process = spawnProcess(undefined, "aelf-run-single", [""])
        const output = window.createOutputChannel(`AElf Local Node (port: 1726)`);
        const aelf_process = {port, process, output} as IGanacheProcess;

        try {
            add_all_listeners(output, port, process);
            // await waitGanacheStarted(port, Constants.ganacheRetryAttempts);
            aelf_process.pid = await findPid(port);
        } catch (error) {
            await stop_local_process(aelf_process, true);
            throw error;
        }

        return aelf_process;
    }


    async function stop_local_process(
        aelf_process: IGanacheProcess, 
        kill_out_of_band: boolean
    ): Promise<void> {
        if(!aelf_process)
            return

        const { output, pid, port, process } = aelf_process;
        delete aelf_processes[port];

        if(process) {
            removeAllListeners(process);
            process.kill("SIGINT");
        }

        if(output) {
            output.dispose();
        }

        if(pid && (kill_out_of_band ? true : !!process)) {
            return killPid(pid);
        }
    }


    function add_all_listeners(
        output: OutputChannel, 
        port: number | string, 
        process: ChildProcess
    ): void {
        process.stdout!.on("data", (data: string | Buffer) => {
            output.appendLine(data.toString());
        });

        process.stderr!.on("data", (data: string | Buffer) => {
            output.appendLine(data.toString());
        });

        process.on("exit", () => {
            stop_local_net(port);
        });
    }


    function removeAllListeners(process: ChildProcess): void {
        process.stdout!.removeAllListeners();
        process.stderr!.removeAllListeners();
        process.removeAllListeners();
    }

    async function is_local_aelf() {
        try {
            const chain_status = await AElfService.get_chain_status() 
            console.debug("CHAIN STATUS WHICH INDICATES PORT IS AELF:", chain_status)
            return true
        } catch(err) {
            return false
        }
    }

    async function waitGanacheStarted(port: number | string, maxRetries: number = 1): Promise<void> {
        const retry = async (retries: number) => {
            if(retries < maxRetries) {
                if(await is_local_aelf()) {
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, Constants.ganacheRetryTimeout));
                await retry(retries + 1);
            } else {
                throw new Error(Constants.ganacheCommandStrings.cannotStartServer);
            }
        };
        await retry(0);
    }
}
