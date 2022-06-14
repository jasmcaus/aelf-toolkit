import * as jsoncParser from "jsonc-parser"

const PARSE_OPTIONS = {
    allowEmptyContent: true,
    allowTrailingComma: true,
    disallowComments: false,
}

export class JSONC {
    static editJsonString(
        jsonString: string,
        jsonPath: jsoncParser.JSONPath,
        value: any
    ) {
        return jsoncParser.applyEdits(
            jsonString,
            jsoncParser.modify(jsonString, jsonPath, value, {
                formattingOptions: {
                    insertSpaces: true,
                    tabSize: 4,
                },
            })
        )
    }

    static extractComments(json: string) {
        const comments: string[] = []
        jsoncParser.visit(
            json,
            { onComment: (offset, length) => comments.push(json.substr(offset, length)), },
            PARSE_OPTIONS
        )
        return comments
    }


    static parse(input: string): any {
        const errors: jsoncParser.ParseError[] = []
        const result = jsoncParser.parse(input, errors, PARSE_OPTIONS)
        if(errors.length) {
            const elipsis = errors.length > 3
            errors.length = Math.min(errors.length, 3)
            throw new Error(
                `JSON parse error${errors.length > 1 ? "s" : ""} (${errors
                    .map(
                        (_) => `${jsoncParser.printParseErrorCode(_.error)} at ${_.offset}`
                    )
                    .join(", ")}${elipsis ? ", ..." : ""})`
            )
        }

        if(!result) {
            throw new Error("Unknown JSON parse error (parse)")
        }
        return result
    }


    static stringify(input: any) {
        return JSON.stringify(input, undefined, 4)
    }
}