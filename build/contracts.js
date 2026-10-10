"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var contracts_exports = {};
__export(contracts_exports, {
  LATENCY_CLASSES: () => LATENCY_CLASSES,
  PRIVACY_CLASSES: () => PRIVACY_CLASSES,
  TASK_TYPES: () => TASK_TYPES
});
module.exports = __toCommonJS(contracts_exports);
const TASK_TYPES = [
  "SIMPLE_INTERPRETATION",
  "COMPLEX_INTERPRETATION",
  "DIAGNOSIS",
  "PLANNING",
  "SUMMARIZATION"
];
const PRIVACY_CLASSES = ["LOCAL_ONLY", "CLOUD_REDACTED", "CLOUD_ALLOWED"];
const LATENCY_CLASSES = ["INTERACTIVE", "NORMAL", "BACKGROUND"];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LATENCY_CLASSES,
  PRIVACY_CLASSES,
  TASK_TYPES
});
//# sourceMappingURL=contracts.js.map
