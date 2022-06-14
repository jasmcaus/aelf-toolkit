
import { OutputChannel, window } from "vscode"

export class Output {
    private static _outputChannel: OutputChannel = window.createOutputChannel("AElf Toolkit")

    public static output(label: string, message: string): void {
        this._outputChannel.append(this.formatMessage(label, message))
    }

    public static output_line(label: string, message: string): void {
        this._outputChannel.appendLine(this.formatMessage(label, message))
    }

    public static show(): void {
        this._outputChannel.show()
    }

    public static hide(): void {
        this._outputChannel.hide()
    }

    public static dispose(): void {
        this._outputChannel.dispose()
    }

    private static formatMessage(label: string = "", message: string = ""): string {
        return `${label ? `${label}>>> ` : ""}${message}`
    }
}
