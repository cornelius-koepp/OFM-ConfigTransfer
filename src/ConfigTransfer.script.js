
// TODO update format to v1 when stable
var uctAidParts = "%AID%".split("-");
var uctFormatVer = "cv0";
var uctGenVer = "0.1.0";
var uctGen = "uct";
var uctAppId = "0xHHHH";
var uctAppVer = "6.15";
var uctAppName = "StateEngine";


// context { module: ..., channelSource: ..., channelTarget: ..., exportOutput: ..., exportFormat: , importLine:.. , messageOutput: ...}

function btnChannelExport(device, online, progress, context) {
    var module = module_order[device.getParameterByName(context.p_moduleSelection).value];
    var channelSource = device.getParameterByName(context.p_channelSource).value;

    var exportFormatSelection = device.getParameterByName(context.p_exportFormatSelection).value;
    var exportFormat = (exportFormatSelection==3) ? "" : "reduced";
    var separator = (exportFormatSelection==1) ? "\n" : "§";

    // TODO add p_messageOutput again?

    var param_exportOutput = device.getParameterByName(context.p_exportOutput);
    param_exportOutput.value = "";
    param_exportOutput.value = exportModuleChannelToString(device, module, channelSource, exportFormat, separator);
}

function btnChannelImport(device, online, progress, context) {
    // TODO remove module -> is part of export-string!
    // var module = module_order[device.getParameterByName(context.p_moduleSelection).value];
    var module = null;
    // TODO support auto-detection
    var channelTarget = device.getParameterByName(context.p_channelTarget).value;
    var importLine = device.getParameterByName(context.p_importLine).value;
    var param_messageOutput = device.getParameterByName(context.p_messageOutput);
    param_messageOutput.value = importModuleChannelFromString(device, module, channelTarget, importLine);
}

function btnChannelCopy(device, online, progress, context) {
    var module = module_order[device.getParameterByName(context.p_moduleSelection).value];
    var channelSource = device.getParameterByName(context.p_channelSource).value;
    var channelTarget = device.getParameterByName(context.p_channelTarget).value;
    var param_messageOutput = device.getParameterByName(context.p_messageOutput);
    param_messageOutput.value = copyModuleChannel(device, module, channelSource, channelTarget);
}

function btnChannelReset(device, online, progress, context) {
    var module = module_order[device.getParameterByName(context.p_moduleSelection).value];
    var channelTarget = device.getParameterByName(context.p_channelTarget).value;
    var param_messageOutput = device.getParameterByName(context.p_messageOutput);
    param_messageOutput.value = resetModuleChannel(device, module, channelTarget);
}

// function importModuleChannelFromString(device, module, channel, exportStr) {
// function copyModuleChannel(device, module, channelSource, channelTarget) {
// function resetModuleChannel(device, module, channel) {



function serializeParamValue(paramValue) {
    /* TODO check inclusion of ` ` and common characters without encoding */
    return encodeURIComponent(paramValue);
}

function unserializeParamValue(encodedParamValue) {
    return decodeURIComponent(encodedParamValue);
}

function serializeHeader(module, channel) {
    // OpenKNX,v1,0.1.0,0xAFA7:110:StateEngine,LOG:3.8.0,1

    var moduleKey = module;
    var moduleVer = "x.y.z";
    var header = [
        "OpenKNX", 
        uctFormatVer,
        uctGen + ":" + uctGenVer,
        uctAppId + ":" + uctAppVer + ":" + uctAppName,
        moduleKey + ":" + moduleVer,
        channel
    ];
    return header.join(",");

}

function getModuleParamsDef(module, channel) {
    return channel_params[module][channel==0 ? "share" : "templ"];
}

/**
 * Transform configuration of one channel to single-line string representation.
 * @param {object} device - the device object provided by ETS
 * @param {string} module - the module prefix e.g. 'LOG'
 * @param {number} channel - the channel number starting with 1; maximum range [1;99]
 * @param {string?} keyFormat - '','name','full','reduced'
 * @returns {string[]} - string representations of channel-configuration, different from default value each of format "{$index}={$value}"
 */
function exportModuleChannelToStrings(device, module, channel, keyFormat) {
    var params = getModuleParamsDef(module, channel);
    
    var result = [];
    for (var i = 0; i < params.names.length; i++) {
        var paramName = params.names[i];
        var paramFullName = module + "_" + paramName.replace('%C%', channel);
        
        /* compact or human readable output */
        var paramKey = i;
        if (keyFormat) {
            if (keyFormat=="full") {
                paramKey = paramName;
            } else if (keyFormat=="reduced") {
                paramKey = paramName.replace('%C%', "~");
            }
        }

        try { 
            var paramValue = device.getParameterByName(paramFullName).value; 
            if (paramValue != params.defaults[i]) { 
                /* non-default values only */
                result.push(paramKey + "=" +  serializeParamValue(paramValue));
            }
        } catch (e) { 
            result.push("[ERR@"+paramKey + "]=" + e + ";" + e.message); 
        }
    }
    return result;
}

/**
 * Transform configuration of one channel to single-line string representation.
 * @param {object} device - the device object provided by ETS
 * @param {string} module - the module prefix e.g. 'LOG'
 * @param {number} channel - the channel number starting with 1; maximum range [1;99]
 * @param {string?} keyFormat - '','name','full','reduced'
 * @param {string} separator - the separator between header and param-values
 * @returns {string} - a string representation of channel-configuration, different from default value "{$index}={$value}§..§{$index}={$value}"
 */
function exportModuleChannelToString(device, module, channel, keyFormat, separator) {
    var lines = exportModuleChannelToStrings(device, module, channel, keyFormat);
    return serializeHeader(module, channel) + separator + lines.join(separator) + separator + ";OpenKNX";
}

function parseHeader(module, channel, headerStr) {
    var header = {
        "prefix": undefined,
        "format": undefined,
        "generator": {
            "name": undefined,
            "ver": undefined
        },
        "app": {
            "id": undefined,
            "ver": undefined,
            "name": undefined
        },
        "modul": {
            "key": undefined,
            "ver": undefined
        },
        "channel": undefined
    };

    var headerParts = headerStr.split(",");

    /* 1. check prefix */
    if (headerParts[0] != "OpenKNX") {
        throw new Error('Format Prefix does NOT match! "' + headerParts[0] + '" != "OpenKNX"');
    }
    header.prefix = headerParts[0];

    /* 2. check format version */
    if (headerParts.length < 2) {
        throw new Error("Format Version NOT defined !");
    }
    if (headerParts[1] != uctFormatVer) {
        throw new Error('Format Version does NOT match! "' + headerParts[1] + '" != "'+uctFormatVer+'"');
    }
    header.format = headerParts[1];

    /* ensure header completeness */
    if (headerParts.length < 6) {
        throw new Error("Header is incomplete! Expected 6 entries, but has only " + headerParts.length);
    }

    /* TODO include generator, but can be ignored first */
    var headerGen = headerParts[2];
    header.generator.name = null;
    header.generator.ver = null;

    /* check app */
    var headerApp = headerParts[3].split(":");
    /* TODO include app-check, but can be ignored first */
    header.app.id = headerApp[0];
    header.app.ver = (headerApp.length>=2) ? headerApp[1] : null;
    header.app.name = (headerApp.length>=3) ? headerApp[2] : null;

    /* check module */
    var headerModule = headerParts[4].split(":");
    if (headerModule.length > 2) {
        /* TODO check need of handling */
    }
    header.modul.key = headerModule[0];
    header.modul.ver = (headerModule.length>=2) ? headerModule[1] : null;

    /* check channel */
    var headerChannel = headerParts[5];
    /* TODO validate format! */
    header.channel = headerChannel;

    return header;
}

/**
 * Restore a channel configuration from a single-line string representation.
 * @param {object} device - the device object provided by ETS
 * @param {string} module - the module prefix e.g. 'LOG'
 * @param {number} channel - the channel number starting with 1; maximum range [1;99]
 * @param {string} exportStr - a previously exported configuration in the format "{$index}={$value}§..§{$index}={$value}"
 */
function importModuleChannelFromString(device, module, channel, exportStr) {
    var result = [];
    var importLines = exportStr.split("§");

    /*
     OpenKNX,cv0,uct:0.1.0,0xHHHH:6.15:StateEngine,LOG:x.y.z,1
     [0]     [1] [2]       [3]                     [4]       [5]
     */
    var header = parseHeader(module, channel, importLines[0]);

    /* check for completeness */
    var importEnd = importLines[importLines.length-1];
    if (importEnd != ";OpenKNX") {
        throw new Error('Incomplete Import, NO Suffix ";OpenKNX"');
    }

    /* check app */
    if (header.app.id != '*' && header.app.id != uctAppId) {
        throw new Error('Exported from Application "'+header.app.id+'", different from current "'+uctAppId+'"');
    }
    /* TODO check version */

    /* check module */
    if (module != null && header.modul.key != module) {
        throw new Error('Module "'+module+'" expected, but found "'+header.modul.key+'"');
    }
    if (!channel_params[header.modul.key]) {
        throw new Error('Module "'+header.modul.key+'" NOT part of application!');
    }
    module = header.modul.key;

    /* TODO check version */
    /* TODO check channel */


    var params = getModuleParamsDef(module, channel);
    if (!params) {
        throw new Error('No Params defined for Module "'+module+'" and channel "'+channel+'"!');
    }
   
    /* use defaults for values not defined in import*/
    var newValues = params.defaults;

    /* use values from import */
    var importContent = importLines.slice(1, -1);
    for (var i = 0; i < importContent.length; i++) {
        var line = importContent[i].split("=");
        if (line.length >= 2) {
            var paramKey = line[0];
            var paramValue = unserializeParamValue(line.slice(1).join("="));
            var paramIndex = -1;

            var regex = /^\d+$/;
            if (!regex.test(paramKey)) {
                // param is given by name
                var paramName = paramKey.replace("~", '%C%');

                // TODO FIXME: replace with a implementation of better runtime!
                for (var i = 0; i < params.names.length; i++) {
                    if (params.names[i] == paramName) {
                        paramIndex = i;
                        break;
                    }
                }
                // TODO special handling of unknown parameter names!
            } else if (paramKey < newValues.length) {
                // valid index
                paramIndex = paramKey;
            } else {
                // TODO error-handling
            }

            if (paramIndex >=0) {
                newValues[paramIndex] = paramValue;
            } else {
                // TODO handling of invalid parameters!
                throw new Error('Unknown Parameter: '+ paramIndex + ' (line "'+line+'")');
            }
        } else {
            // TODO error-handling; this is not a param=value pair
            throw new Error('Invalid Entry: '+ line);
        }
    };

    /* write new values */
    var regexExcludeValue = /^\%K\d+\%$/;
    for (var i = 0; i < params.names.length; i++) {
        var paramName = params.names[i];
        var paramFullNameTempl = module + "_" + paramName;
        var paramFullName      = module + "_" + paramName.replace('%C%', channel);

        /* TODO make configurable: i || paramName || params.names[i].replace('f%C%', "~") */
        var paramKey = i;
        var paramValue = newValues[i];

        try {
            /* TODO set paramValue to channel-specific value */
            if ((paramValue !=null) && !regexExcludeValue.test(paramValue)) {
                device.getParameterByName(paramFullName).value = paramValue;
            }

        } catch (e) {
            result.push("[ERR@"+paramKey + ";" + paramFullNameTempl + "=" + paramValue + "]=" + e + ";" + e.message);
        }
    }
    /* TODO check need of validation, or repeated writing to compensate values updated by ETS, e.g. by calc */    

    return result.length>0 ? result.join("§") : "[Import OK]";
}

/**
 * Copy the configuration from one channel to an other.
 * @param {object} device - the device object provided by ETS
 * @param {string} module
 * @param {number} channelSource 
 * @param {number} channelTarget 
 */
function copyModuleChannel(device, module, channelSource, channelTarget) {
    /* TODO copy without serialize/deserialize */
    var exportStr = exportModuleChannelToString(device, module, channelSource);
    importModuleChannelFromString(device, module, channelTarget, exportStr);
}

/**
 * Set channel configuration to default values.
 * LIMITATION: Default values are independent of assignments.
 * @param {object} device - the device object provided by ETS
 * @param {string} module 
 * @param {number} channel 
 */
function resetModuleChannel(device, module, channel) {
    importModuleChannelFromString(device, module, channel, serializeHeader(module, channel) + '§' + ";OpenKNX");
}
