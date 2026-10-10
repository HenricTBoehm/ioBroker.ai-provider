"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var response_contract_registry_exports = {};
__export(response_contract_registry_exports, {
  ResponseContractRegistry: () => ResponseContractRegistry
});
module.exports = __toCommonJS(response_contract_registry_exports);
var import_ajv = __toESM(require("ajv"));
var import_errors = require("../errors");
const SCHEMAS = [
  {
    id: "smarthome.assessment-result",
    version: "1",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["classification", "summary", "recommendations", "confidence"],
      properties: {
        classification: {
          type: "string",
          enum: ["NORMAL", "WATCH", "ACTION_RECOMMENDED", "UNCLEAR"]
        },
        summary: { type: "string", minLength: 1, maxLength: 2e3 },
        recommendations: {
          type: "array",
          maxItems: 10,
          items: { type: "string", minLength: 1, maxLength: 500 }
        },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    }
  }
];
function key(id, version) {
  return `${id}@${version}`;
}
class ResponseContractRegistry {
  contracts;
  constructor() {
    const ajv = new import_ajv.default({ allErrors: true, strict: true });
    this.contracts = new Map(
      SCHEMAS.map((definition) => [
        key(definition.id, definition.version),
        { ...definition, validate: ajv.compile(definition.jsonSchema) }
      ])
    );
  }
  resolve(id, version) {
    const contract = this.contracts.get(key(id, version));
    if (!contract) {
      throw new import_errors.GovernedError("UNKNOWN_RESPONSE_CONTRACT", `Unknown response contract ${id}@${version}`);
    }
    return contract;
  }
  validate(contract, rawText) {
    var _a;
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new import_errors.GovernedError("SCHEMA_VALIDATION_FAILED", "Model output is not valid JSON");
    }
    if (!contract.validate(parsed)) {
      const detail = (_a = contract.validate.errors) == null ? void 0 : _a.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
      throw new import_errors.GovernedError(
        "SCHEMA_VALIDATION_FAILED",
        `Model output violates the response contract: ${detail}`
      );
    }
    return parsed;
  }
  list() {
    return [...this.contracts.values()].map(({ id, version }) => ({ id, version }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ResponseContractRegistry
});
//# sourceMappingURL=response-contract-registry.js.map
