// Identify only the isolated fixture launched by this test.
const {execFileSync} = require('node:child_process');
const path = require('node:path');
module.exports = function browserAccess(root, data, origin) {
  const script = [
    'import json, sys',
    'from local_app import installation_id',
    'from local_access import identify, local_client, user_secret',
    'origin = sys.argv[2]',
    'access = identify(local_client(), origin, installation_id(".", sys.argv[1]), user_secret())',
    'assert access, "isolated server identity did not match"',
    'print(json.dumps({"link": access.browser_url(origin), "headers":{"X-CanvasFlow-Session":access.desktop_token}}))'
  ].join('\n');
  return JSON.parse(execFileSync(path.join(root, '.runtime/python/python.exe'), ['-c', script, data, origin],
    {cwd:root, env:{...process.env, LOCALAPPDATA:data}, windowsHide:true, encoding:'utf8'}));
};

