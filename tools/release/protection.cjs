'use strict';
const obfuscator = require('javascript-obfuscator');
// Preserve browser globals and public object properties shared across scripts.
// Avoid timing traps and control-flow inflation in the 3D rendering hot paths.
module.exports = function protect(code, module = false, seed = 1000) {
  return obfuscator.obfuscate(code, {
    target: module ? 'browser' : 'browser-no-eval', compact: true,
    identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
    renameProperties: false, controlFlowFlattening: false, deadCodeInjection: false,
    debugProtection: false, selfDefending: false, disableConsoleOutput: false,
    stringArray: true, stringArrayThreshold: .7, stringArrayEncoding: ['base64'],
    splitStrings: false, numbersToExpressions: false, simplify: true,
    sourceMap: false, seed,
  }).getObfuscatedCode();
};
