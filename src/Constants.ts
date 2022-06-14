
import os from "os"
import fs from "fs-extra"
import path from "path"
import { ExtensionContext, extensions } from "vscode"
import { get_workspace_root } from "./helpers/workspace"

export class Constants {
    public static settings_json_text: { [setting_name: string]: string } = {
        "dotnet-test-explorer.testProjectPath": "**/*Tests.csproj"
    }
    
    public static tasks_json = [
        {
            cwd: "${workspaceFolder}/contracts/<CONTRACTNAME>/src/AElf.Boilerplate.ContractPatcher",
            label: "restore",
            command: "dotnet",
            type: "shell",
            args: ["restore"],
            problemMatcher: [],
        },
        {
            cwd: "${workspaceFolder}/contracts/<CONTRACTNAME>/contract/<CONTRACTNAME>",
            label: "build",
            dependsOnLabel: "restore",
            group: "build",
            type: "shell",
            command: "dotnet",
            args: [
                "build",
                "/property:GenerateFullPaths=true",
            ],
            problemMatcher: "$msCompile",
            autoRun: true,
        },
    ]

    public static format_elf(value: number) {
        return value * 10e8
    }


    public static initialize(context: ExtensionContext) {
        this.deployed_contracts_folder = path.join(get_workspace_root()!, "deployed-contracts")
        this.deployed_contracts_json = path.join(this.deployed_contracts_folder, "deployed-contracts.json")
    }