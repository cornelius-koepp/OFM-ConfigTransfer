import xml.etree.ElementTree as ET
import json

#
# TODO replace XML-Lib!
#


def template_to_params(xml_string):
    root = ET.fromstring(xml_string)
    resultNames = []
    resultDefaults = []
    for param in root.findall('.//{http://knx.org/xml/project/20}Parameter'):
        if param.get('Access') != 'None':
            resultNames.append(param.get('Name'))
            resultDefaults.append(param.get('Value'))
    result = {"names": resultNames, "defaults": resultDefaults}
    # return json.dumps(result, indent=2)
    return json.dumps(result)


path = "lib/OFM-LogicModule/src/"
filenameTemplate = path + "Logikmodul.templ.xml"
filenameOutput = filenameTemplate + ".params.json"

with open(filenameTemplate, "r", encoding='utf-8') as fileTemplate:
    json_result = template_to_params(fileTemplate.read())
    with open(filenameOutput, "w", encoding='utf-8') as fileOutput:
        fileOutput.write(json_result)
        print('written to ' + filenameOutput)