async function getParams(method) {
    const fields = Object.entries(method.inputTypeInfo.fields || {});
    let result = {};
    if (fields.length > 0) {
        if (isSpecialParameters(method.inputType)) {
            let prompts = PROTO_TYPE_PROMPT_TYPE.default;
            prompts = {
                ...prompts,
                name: 'value',
                message: 'Enter the required param <value>:'
            };
            // eslint-disable-next-line no-await-in-loop
            const promptValue = (await inquirer.prompt(prompts)).value;
            result = parseJSON(promptValue);
        } else {
            for (const [field_name, field_type] of fields) {
                const { type, rule } = field_type;
                let inner_type = null;
                try {
                    inner_type = method.inputType.lookupType(type);
                } catch (e) {}

                let param_value
                // todo: use recursion
                // eslint-disable-next-line max-len
                if (rule !== 'repeated' && inner_type && !isSpecialParameters(inner_type) && (type || '').indexOf('google.protobuf.Timestamp') === -1) {
                    let innerResult = {};
                    const innerInputTypeInfo = inner_type.toJSON();
                    const innerFields = Object.entries(innerInputTypeInfo.fields || {});
                    if (isSpecialParameters(innerFields)) {
                        let prompts = PROTO_TYPE_PROMPT_TYPE.default;
                        prompts = {
                        ...prompts,
                        name: 'value',
                        message: `Enter the required param <${field_name}.value>:`
                        };
                        // eslint-disable-next-line no-await-in-loop
                        innerResult = (await inquirer.prompt(prompts)).value;
                    } else {
                        // eslint-disable-next-line no-restricted-syntax
                        for (const [innerFieldName, innerFieldType] of innerFields) {
                            // eslint-disable-next-line no-await-in-loop
                            innerResult[innerFieldName] = parseJSON(await getParamValue(innerFieldType.type, `${field_name}.${innerFieldName}`));
                        }
                    }
                    param_value = innerResult
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    param_value = await getParamValue(type, field_name)
                }

                result[field_name] = parseJSON(param_value)
            }
        }
    }

    return result;
}



async function getParamValue(type, fieldName) {
    let prompts = PROTO_TYPE_PROMPT_TYPE[type] || PROTO_TYPE_PROMPT_TYPE.default;
    const fieldNameWithoutDot = fieldName.replace('.', '');
    prompts = {
      ...prompts,
      name: fieldNameWithoutDot,
      message: `Enter the required param <${fieldName}>:`
    };
    // eslint-disable-next-line no-await-in-loop
    const promptValue = (await inquirer.prompt(prompts))[fieldNameWithoutDot];
    // eslint-disable-next-line no-await-in-loop
    let value = parseJSON(await prompts.transformFunc(promptValue));
    if (typeof value === 'string' && isFilePath(value)) {
        const filePath = path.resolve(process.cwd(), value);
        // eslint-disable-next-line no-await-in-loop
        const { read } = await inquirer.prompt({
            type: 'confirm',
            name: 'read',
            // eslint-disable-next-line max-len
            message: `It seems that you have entered a file path, do you want to read the file content and take it as the value of <${fieldName}>`
        });
        
        if (read) {
            try {
                fs.accessSync(filePath, fs.constants.R_OK);
            } catch (err) {
                throw new Error(`permission denied, no read access to file ${filePath}!`);
            }

            value = fs.readFileSync(filePath).toString('base64');
        }
    }
    return value;
  }