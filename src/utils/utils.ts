
import fs from "fs-extra"
import path from "path"
import { InputBoxOptions, ProgressLocation, QuickPickItem, QuickPickOptions, Uri, window, workspace } from "vscode";
import { Constants, NotificationOptions } from "../Constants";
import AElf from "aelf-sdk"


export async function showInputBox(options: InputBoxOptions): Promise<string> {
    const result = await window.showInputBox(options);

    // if(result === undefined) {
    //     throw new CancellationEvent();
    // }

    return result!
}

export async function showQuickPickMany<T extends QuickPickItem>(
    items: T[] | Promise<T[]>,
    options: QuickPickOptions & {canPickMany: true}
): Promise<T[]> {
    const result = await window.showQuickPick(items, options);

    // if(result === undefined) {
    //     throw new CancellationEvent();
    // }

    return result!;
}

export async function showQuickPick<T extends QuickPickItem>(
    items: T[] | Promise<T[]>,
    options: QuickPickOptions
): Promise<T> {
    const result = await window.showQuickPick(items, options);

    // if(result === undefined) {
    //     throw new CancellationEvent();
    // }

    return result!;
}

export function copy_file(
    from: string,
    to: string
) {
    const contents = fs.readFileSync(from, "utf-8")
    fs.writeFileSync(to, contents, "utf8")
}


export function copy_folders(
    from: string,
    to: string,
    should_delete_to: boolean = false
) {
    if(should_delete_to && fs.existsSync(to)) {
        fs.rmSync(to, { recursive: true, force: true })
        fs.mkdirSync(to)
    } 

    if(!fs.existsSync(to)) {
        fs.mkdirsSync(to)
    }

    const files = fs.readdirSync(from);
    files.forEach(file => {
        const original = path.join(from, file)
        const stats = fs.statSync(original)

        if(stats.isFile()) {
            const _path = path.join(to, file)
            copy_file(original, _path)
        } else if(stats.isDirectory()) {
            fs.mkdirSync(path.join(to, file))
            copy_folders(
                path.join(from, file),
                path.join(to, file)
            )
        }
    })
}


export function delete_folder(
    folder_path: string,
    should_remake: boolean = true
) {
    if(fs.existsSync(folder_path)) {
        fs.rmSync(folder_path, { recursive: true, force: true })
        if(should_remake) {
            fs.mkdirsSync(folder_path)
        }
    }
}

export function get_posix_path(...components: string[]) {
    return path.join(...components)
               .split(path.sep)
               .join(path.posix.sep)
}


export function mkdir_if_not_exists(path: string) {
    if(!fs.existsSync(path)) {
        fs.mkdirsSync(path)
    }
}


export function delete_if_exists(
    path: string,
    should_remake: boolean = false
) {
    if(fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true })

        if(should_remake) { 
            fs.mkdirsSync(path)
        }
    }
}


export function recurse_through(directory: string) {
    let files: string[] = []
    function ___recurse_through(directory: string) {
        fs.readdirSync(directory).forEach(file => {
            const abs = path.join(directory, file)
            
            if (fs.statSync(abs).isDirectory()) {
                return ___recurse_through(abs)
            } else {
                return files.push(abs)
            }
        })

        return files
    }

    return ___recurse_through(directory)
}


export function safe_json_parse(obj: any) {
    let result = null
    try {
        result = JSON.parse(obj)
    } catch(err) {
        console.debug("ERRORORRO:", err)
        result = ""
    }

    return result
}


export function is_file_path(
    val: string, 
    workspace_root: string
) {
    if (!val) {
        return false;
    }

    const filePath = path.resolve(workspace_root, val);
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile();
    } catch (e) {
        return false;
    }
}


export function write_obj_to_file(
    obj: any,
    file: string
) {
    mkdir_if_not_exists(path.dirname(file))

    fs.writeFileSync(
        file,
        JSON.stringify(obj, null, 4)
    )
}


export async function show_open_folder_dialog(): Promise<string> {
    const folder = await window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Choose new path",
    });

    // if(!folder) {
    //     throw new CancellationEvent();
    // }

    return folder![0].fsPath;
}


// export async function showOpenFileDialog(): Promise<string> {
//     const defaultFolder = workspace.workspaceFolders ? workspace.workspaceFolders[0].uri.fsPath : "";
//     const folder = await window.showSaveDialog({
//         defaultUri: Uri.parse(defaultFolder),
//         saveLabel: Constants.placeholders.selectMnemonicStorage,
//     });

//     // if(!folder) {
//     //     throw new CancellationEvent();
//     // }

//     return folder!.fsPath;
// }


// export async function saveTextInFile(
//     text: string,
//     defaultFilename: string,
//     ext?: {[name: string]: string[]}
// ): Promise<string> {
//     const file = await window.showSaveDialog({
//         defaultUri: Uri.file(defaultFilename),
//         filters: ext,
//     });

//     // if(!file) {
//     //     throw new CancellationEvent();
//     // }

//     fs.writeFileSync(file!.fsPath, text);
//     return file!.fsPath;
// }


// export async function showConfirmationDialog(message: string): Promise<boolean> {
//     const answer = await window.showInformationMessage(
//         message,
//         Constants.confirmationDialogResult.yes,
//         Constants.confirmationDialogResult.no
//     );

//     return answer === Constants.confirmationDialogResult.yes;
// }


// export async function showNotification(options: Notification.IShowNotificationOptions): Promise<void> {
//     options.type = options.type || NotificationOptions.info;

//     Notification.types[options.type](options.message);
// }


export async function show_ignorable_notification(
    message: string, 
    fn: () => Promise<any>
): Promise<void> {
    const ignoreNotification = false

    await window.withProgress(
        {
            location: ProgressLocation.Window,
            title: message,
        },
        async () => {
            if(ignoreNotification) {
                await fn();
            } else {
                await window.withProgress(
                    {
                        location: ProgressLocation.Notification,
                        title: message,
                    },
                    fn
                );
            }
        }
    );
}

export async function showNotificationConfirmationDialog(
    message: string,
    positiveAnswer: string,
    cancel: string
): Promise<boolean> {
    const answer = await window.showInformationMessage(message, positiveAnswer, cancel);

    return answer === positiveAnswer;
}

namespace Notification {
    export const types = {
        error: window.showErrorMessage,
        info: window.showInformationMessage,
        warning: window.showWarningMessage,
    };

    export interface IShowNotificationOptions {
        type?: NotificationOptions.error | NotificationOptions.warning | NotificationOptions.info;
        message: string;
    }
}