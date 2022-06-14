import path from "path"
import fs from "fs-extra"
import AElf from "aelf-sdk"

import { get_workspace_root } from "../helpers/workspace"
import { 
    is_file_path,
    mkdir_if_not_exists, 
    recurse_through, 
    safe_json_parse,
    write_obj_to_file
} from "../utils"
import { Output } from "../Output"
import { window } from "vscode"
const moment = require("moment")


class __AElfService {
    private __local_endpoint: string = "http://127.0.0.1:1726"
    private __set_endpoint: string = ""
    private __aelf: any = undefined
    private __wallets: any[] = []
    private __genesis_contract_address: string = ""
    private __wallets_path: string = ""


    constructor() {
        const workspace_root = get_workspace_root()!
        this.__wallets_path = path.join(workspace_root, "wallets")
    }


    instantiate_instance(is_testnet: boolean) {
        let endpoint: string
        if(is_testnet) {
            endpoint = "https://tdvw-test-node.aelf.io"
        } else {
            endpoint = this.__local_endpoint
        }

        this.__aelf = new AElf(new AElf.providers.HttpProvider(endpoint))
        this.__set_endpoint = endpoint
        this.output(`Created local instance at ${endpoint}`)
    }


    undefine_instance() {
        this.__aelf = undefined
    }


    is_on_testnet(): boolean {
        if(this.__set_endpoint === this.__local_endpoint) {
            return false
        }
        return true
    }


    async get_genesis_contract_address() {
        if(this.__genesis_contract_address === "") {
            this.__genesis_contract_address = (await this.get_chain_status()).GenesisContractAddress
        }

        return this.__genesis_contract_address
    }

    get_genesis_wallet() {
        return AElf.wallet.getWalletByPrivateKey("371398edff803a73a035f9e376693a80ce7e00a10f0d2f09bc861d52c137cabc")
    }

    async get_genesis_contract() {
        const genesis_contract_address = await this.get_genesis_contract_address()
        const genesis_contract = await this.__aelf.chain.contractAt(genesis_contract_address, this.get_genesis_wallet())
        return genesis_contract
    }


    get_wallets(): any {
        let wallets: any = []
        // Search for locally available wallets
        const wallet_json_files = recurse_through(this.__wallets_path)
        console.debug("wallet_json_files:", wallet_json_files)
        wallet_json_files.map((wallet_file: string) => {
            const wallet = this.get_wallet_from_file(wallet_file)!.wallet

            if(wallet) {
                wallets.push(wallet)
            }
        })

        return wallets
    }
   
    
    async get_block_height(
        is_testnet: boolean = false
    ): Promise<number> {
        if(!is_testnet) {
            const aelf = await this.get_aelf_instance()

            const block_height = await aelf.chain.getBlockHeight()
            window.showInformationMessage("Block height:\n", block_height)

            this.output(`Block height: ${block_height}`)
            return block_height as number
        }

        throw new Error("TODO: [get_block_height] Testnet")
    }

    
    async get_block_info(
        height_or_block_hash: string,
        include_txs: boolean = false,
        is_testnet: boolean = false,
    ): Promise<any> {
        if(!is_testnet) {
            const aelf = await this.get_aelf_instance()

            let block_info: any
            // Block hash is usually hex-encoded and has 64 characters
            if(String(height_or_block_hash).trim().length > 50) {
                block_info = aelf.chain.getBlock(height_or_block_hash, include_txs)
            } else {
                block_info = aelf.chain.getBlockByHeight(height_or_block_hash, include_txs)
            }

            this.output(`Block info: ${JSON.stringify(block_info)}`)
            return block_info
        }
            
        throw new Error("TODO: [get_block_info] Testnet")
    }


    async get_chain_status(
        is_testnet: boolean = false
    ): Promise<any> {
        if(!is_testnet) {
            const aelf = await this.get_aelf_instance()

            const status = await aelf.chain.getChainStatus()
            this.output(`Chain Status: ${JSON.stringify(status, null, 4)}`)

            return status
        }
            
        throw new Error("TODO: [get_chain_status] Testnet")
    }


    async get_tx_result(
        tx_id: string,
    ): Promise<any> {
        const aelf = await this.get_aelf_instance()

        let tx_result: any
        try {
            tx_result = await aelf.chain.getTxResult(tx_id)
        } catch(err) {
            console.debug(`Error: `, err)
            if((err as any).Error !== undefined) {
                throw new Error(`Error: ${(err as any).Status}: ${(err as any).Error}`)
            }
            throw new Error("Error when getting Tx Result. See output for more details.")
        }

        // console.debug("Transaction Result:", JSON.stringify(tx_result, null, 4))
        // this.output(`Transaction result: ${JSON.stringify(tx_result, null, 4)}`)

        return tx_result
    }


    async create_wallet(
        wallet_name: string,
        wallet_password: string
    ) {
        const wallet = AElf.wallet.createNewWallet()
        wallet.publicKey = wallet.keyPair.getPublic().encode("hex")

        // Save to keystore
        const cipher = "aes-128-ctr"
        const keystore = AElf.wallet.keyStore.getKeystore(
            wallet,
            wallet_password,
            { cipher }
        )
        keystore.nickName = wallet_name
        keystore.unencrypted_password = wallet_password
        keystore.unencrypted_publicKey = wallet.publicKey
        keystore.unencrypted_privateKey = wallet.privateKey
        keystore.unencrypted_mnemonic = wallet.mnemonic
        keystore.local_balance = 0
        keystore.tdvw_balance = 0
        

        const keystore_path = path.resolve(
                                    this.__wallets_path, 
                                    `${wallet_name}-${wallet.address}.aelf-toolkit.json`
                                )

        write_obj_to_file(
            keystore,
            keystore_path
        )

        // Print wallet info
        const text = `
Your Wallet info:

Name:            ${wallet.name}
Address:         ${wallet.address}
Mnemonic:        ${wallet.mnemonic}
Public Key:      ${wallet.publicKey}
Private Key:     ${wallet.privateKey}
Saved to ${keystore_path}
`
        this.output(text)

        this.__wallets.push(wallet)

        window.showInformationMessage(
            `Wallet "${wallet_name}" (address: ${wallet.address}) created successfully! Don't forget to transfer some ELF to start using this wallet`
        )
    }

    async get_fields(contract_address: string) {
        const contract_obj = await this.__get_contract(
                                        contract_address,
                                        await this.get_genesis_wallet()
                                    )
        
        console.debug("Contract Obj:", contract_obj)
        return Object.keys(contract_obj)
    }

    async send(
        contract_address: string,
        method: any,
        params: any,
        wallet: any,
        should_show_information: boolean = false
    ): Promise<string> {
        // The result of a `send` transaction is always a txid
        const result = await this.__transact(
            contract_address,
            method,
            params,
            wallet,
            false
        )
        
        const tx_id = result.TransactionId

        console.debug("Transaction id:", tx_id)
        this.output(`Transaction id: ${tx_id}`)

        if(should_show_information) {
            window.showInformationMessage(
                `Transaction succeeded: ${tx_id}`
            )
        }

        return tx_id as string
    }


    async call(
        contract_address: string,
        method: any,
        params: any,
        wallet: any
    ): Promise<any> {
        const result = await this.__transact(
            contract_address,
            method,
            params,
            wallet,
            true
        )
        
        return result
    }


    async get_balance(wallet: any) {
        if(typeof wallet === "string") {
            throw new Error("[get_balance] Ensure you construct a wallet object first. Do not pass a string")
        }

        // Get balance
        const result = await this.call(
            "AElf.ContractNames.Token",
            "GetBalance",
            {
                symbol: "ELF",
                owner: wallet.address
            },
            wallet
        )
        const balance = parseFloat(result.balance) / 1e8
        console.debug("Parsed balance:", balance)
        console.debug("Balance result:", result)

        // Write the balance to the wallet JSON file
        const wallet_json_file = this.__get_wallet_json_file_from_nickname(
            wallet.nickName as string,
            wallet.address as string
        )

        const wallet_json = JSON.parse(fs.readFileSync(wallet_json_file).toString())

        if(this.is_on_testnet()) {
            wallet_json.tdvw_balance = balance.toString()
        } else {
            wallet_json.local_balance = balance.toString()
        }

        write_obj_to_file(wallet_json, wallet_json_file)

        return balance
    }
    

    get_wallet_from_nickname(
        nickname: string
    ): { wallet: any; filepath: string } {
        const wallet_json_file = this.__get_wallet_json_file_from_nickname(nickname)

        const wallet = this.get_wallet_from_file(wallet_json_file)!.wallet

        return {
            wallet: wallet,
            filepath: wallet_json_file
        }
    }


    get_wallet_from_file(
        path: string,
        should_throw: boolean = true
    ): { keystore: any; wallet: any } | undefined {
        let content: string
        if(fs.existsSync(path)) {
            content = fs.readFileSync(path).toString()
        } else {
            throw new Error(`Internal error. File ${path} doesn't exist`)
        }

        const keystore = JSON.parse(content)
        if(Object.keys(keystore).length === 0) {
            throw new Error(`Path ${path} exists, but is empty`)
        }

        try {
            const _ = keystore.unencrypted_password
        } catch (err) {
            // This must be an external wallet which we do not control
            return undefined
        }

        let wallet
        try {
            const { privateKey } = AElf.wallet.keyStore.unlockKeystore(
                                                            keystore, 
                                                            keystore.unencrypted_password
                                                        )
            wallet = AElf.wallet.getWalletByPrivateKey(privateKey)

            wallet.nickName = keystore.nickName
            wallet.unencrypted_password = keystore.unencrypted_password
            wallet.unencrypted_publicKey = keystore.unencrypted_publicKey
            wallet.unencrypted_privateKey = keystore.unencrypted_privateKey
            wallet.unencrypted_mnemonic = keystore.unencrypted_mnemonic
            wallet.local_balance = keystore.local_balance
            wallet.tdvw_balance = keystore.tdvw_balance
        } catch (err) {
            if(should_throw) {
                throw new Error(`Wallet password possibly incorrect. Error: ${(err as Error).toString()}`)
            }

            return undefined
        }

        return {
            keystore: keystore,
            wallet: wallet
        }
    }


    /*
        Internal Methods
    */
    private async get_aelf_instance() {
        if(!this.__aelf) {
            const err_msg = "You don't have a local instance running. Spin up one before continuing"
            window.showErrorMessage(err_msg)
            throw new Error(err_msg)
        } else {
            // Make a test call to check if the endpoint is actually legit
            try {
                const _ = await this.__aelf.chain.getChainStatus()
            } catch (err) {
                const err_msg = `The selected endpoint ${this.__local_endpoint} is invalid. See output for more details.`
                window.showErrorMessage(err_msg)
                this.output(`[get_aelf_instance]:\n${(err as Error).toString()}`)
                throw new Error(err_msg)
            }
        }

        return this.__aelf
    }

    
    // Return wallet `*.aelf-toolkit.json` file string that best represents a wallet file
    private __get_wallet_json_file_from_nickname(
        nickname: string,
        address: string = ""
    ): string {
        const wallet_files = recurse_through(this.__wallets_path)

        for(const wallet_file of wallet_files) {
            const basename = path.basename(wallet_file)

            if(basename.startsWith(`${nickname}-${address}`)) {
                return wallet_file
            }
        }

        throw new Error(`Internal error. We couldn't find a wallet file in your current working directory that matches your wallet: "${nickname} and ${address}"`)
    }


    public async TESTER(
        contract_address: string
    ) {
        const contract = await this.__get_contract(contract_address, await this.get_genesis_wallet())
        return contract
    }

    public async get_contract_params(
        contract_address: string,
        _method: string | any,
        _params: any | undefined,
        wallet: any
    ) {
        const contract = await this.__get_contract(contract_address, wallet)
        const method = this.__get_method_obj(_method, contract)

        let params = ""

        // If the method doesn't really require any parameters
        if(method.inputTypeInfo && 
          (Object.keys(method.inputTypeInfo.fields).length === 0 || !method.inputTypeInfo.fields)
        ) {
            params = ""
        } else {
            // Need parameters
            if(_params) {
                try {
                    params = JSON.parse(_params)
                } catch {
                    // The params are already a JS object
                    params = _params 
                }
            } else {
                // Prompt for params
                const params_from_method = await this.__prompt_for_method_params(method)
                params = JSON.parse(JSON.stringify(params_from_method))
            }
        }

        return {
            contract: contract,
            method: method,
            params: params
        }
    }

    private async __transact(
        contract_address: string,
        _method: string | any,
        _params: any | undefined,
        wallet: any,
        should_call: boolean
    ) {
        const contract_details = await this.get_contract_params(
            contract_address,
            _method,
            _params,
            wallet
        )
        
        const method = contract_details.method
        const params = contract_details.params

        console.debug("Params:", params)

        let result: any
        if(should_call) {
            result = await method.call(params)
        } else {
            result = await method(params)
        }

        return result
    }


    private __get_method_obj(
        method: any,
        contract: any
    ) {
        if(typeof method !== "string") {
            return method;
        }

        if(contract[method]) {
            return contract[method]
        }

        throw new Error(`Method ${JSON.stringify(method)} doesn't exist for contract`)
    }


    public async __prompt_for_method_params(
        method: any,
    ) {
        const fields: any = Object.entries(method.inputTypeInfo.fields || {})
        let result: any = {}

        if(fields.length === 0)
            return result
        
        if(this.__is_special_params(method.inputType)) {
            const prompt = await window.showInputBox({
                placeHolder: `Enter value for param: <value>:`
            })
            result = JSON.parse(prompt!)
        } else {
            // Loop over params:
            for(const [field_name, field_type] of fields) {
                const { type, rule } = field_type
                let inner_type = null
                try {
                    inner_type = method.inputType.lookupType(type)
                } catch(err) { }

                let param_value

                if(rule !== "repeated" &&
                   inner_type &&
                   !this.__is_special_params(inner_type) &&
                   (type || "").indexOf("google.protobuf.Timestamp") === -1
                ) {
                    let inner_result: any = {}
                    const inner_input_type_info = inner_type.toJSON()
                    const inner_fields: any = Object.entries(inner_input_type_info.fields || {})
                    if(this.__is_special_params(inner_fields)) {
                        const prompt = await window.showInputBox({
                            placeHolder: `Enter value for param: <${field_name}>:`
                        })
                        inner_result = JSON.parse(prompt!)
                    } else {
                        for(const [inner_field_name, inner_field_type] of inner_fields) {
                            inner_result[inner_field_name] = safe_json_parse(
                                await this.__get_param_value(
                                    inner_field_type.type,
                                    `{field_name}.${inner_field_name}`
                                )
                            )
                        }
                    }

                    param_value = inner_result
                } else {
                    param_value = await this.__get_param_value(
                        type,
                        field_name
                    )
                }
                result[field_name] = safe_json_parse(param_value)
            }
        }

        return result 
    }


    private async __get_param_value(
        type: any,
        field_name: any
    ) {
        const field_name_without_dot = field_name.replace(".", "")
        let param
        
        if(type === "google.protobuf.Timestamp") {
            // Format:
            // YYYY/MM/DD HH:MM
            const format = "YYYY/MM/DD"
            param = await window.showInputBox({
                placeHolder: `Enter value for param: <${field_name_without_dot}> in the format: YYYY/MM/DD HH:MM`
            })
            console.debug("Timestamp value:", param!)
            const temp = param!
            param = {
                seconds: moment(temp, format).unix(),
                nanos: moment(temp, format).milliseconds() * 1000
            }
        } else {
            param = (await window.showInputBox({
                placeHolder: `Enter value for param: <${field_name_without_dot}>`
            }))!
            param = JSON.stringify(param)
            console.debug("=========> PARAM:", param)

            if(typeof param === "string" && is_file_path(param, get_workspace_root()!)) {
                // Read file
                const filepath = path.resolve(get_workspace_root()!, param)
                param = fs.readFileSync(filepath).toString("base64")
            }
        }
        return param
    }


    // Get all contracts available for this contract
    // Gets the contract methods' keys
    private __get_contract_methods(contract = {}) {
        if(!contract) {
            throw new Error(`Expected a contract. Got ${Object.keys(contract)}`)
        }

        return Object.keys(contract)
                     .filter(v => /^[A-Z]/.test(v))
                     .sort()
    }


    private async __get_contract(
        contract_address: string, // can be name or address
        wallet: any
    ) {
        let contract: any
        const aelf = await this.get_aelf_instance()

        try {
            if(!contract_address.trim().toLowerCase().startsWith("aelf.")) {
                // contract_address is an actual address
                contract = await aelf.chain.contractAt(contract_address, wallet)
            } else {
                // contract_address is a named string and must be a local AElf Contract
                const genesis_contract_address = await this.get_genesis_contract_address()
                const genesis_contract = await aelf.chain.contractAt(genesis_contract_address, wallet)
                const address = await genesis_contract.GetContractAddressByName.call(AElf.utils.sha256(contract_address))
                contract = await aelf.chain.contractAt(address, wallet)
                this.output(`Contract: ${contract}`)
            }

            return contract
        } catch(err) {
            console.debug("Error: ", (err as Error).toString())
            throw new Error(`Failed to find contract: "${contract_address}". See output for more details.`)
        }
    }


    private __is_special_params(inputType: any) {
        if(
            inputType.fieldsArray &&
            inputType.fieldsArray.length === 1 && 
            ["Hash", "Address"].includes(inputType.name) &&
            inputType.fieldsArray[0].type === "bytes"
        ) {
            return true;
        }

        return false;
    }



    private async getProto(address: string) {
        return AElf.pbjs.Root.fromDescriptor(await this.__aelf.chain.getContractFileDescriptorSet(address))
    }


    async deserialized_logs(logs: []) {
        if(!logs || logs.length === 0)
            return null
    
        let results = await Promise.all(logs.map((v: any) => this.getProto(v.Address)))
        results = results.map((proto, index) => {
            const {
                Name: dataTypeName,
                NonIndexed,
                Indexed = []
            } = logs[index]
    
            const serializedData = [...(Indexed || [])];
            if(NonIndexed) {
                serializedData.push(NonIndexed);
            }
    
            const dataType = proto.lookupType(dataTypeName);
            let deserializeLogResult = serializedData.reduce((acc, v) => {
                let deserialize = dataType.decode(Buffer.from(v, 'base64'))
                deserialize = dataType.toObject(
                                    deserialize, {
                                        enums: String,   // enums as string names
                                        longs: String,   // longs as strings (requires long.js)
                                        bytes: String,   // bytes as base64 encoded strings
                                        defaults: false, // includes default values
                                        arrays: true,    // populates empty arrays (repeated fields) even if defaults=false
                                        objects: true,   // populates empty objects (map fields) even if defaults=false
                                        oneofs: true     // includes virtual oneof fields set to the present field's name
                                    }
                                )
    
                return {
                ...acc,
                ...deserialize
                };
            }, {})
    
            deserializeLogResult = AElf.utils.transform.transform(dataType, deserializeLogResult, AElf.utils.transform.OUTPUT_TRANSFORMERS);
            deserializeLogResult = AElf.utils.transform.transformArrayToMap(dataType, deserializeLogResult);
            return deserializeLogResult;
        })
    
        return results;
    }

    private output(msg: string) {
        Output.output("AElfService", msg)
    }


}


export const AElfService = new __AElfService()