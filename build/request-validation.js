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
var request_validation_exports = {};
__export(request_validation_exports, {
  parseAIRequest: () => parseAIRequest
});
module.exports = __toCommonJS(request_validation_exports);
var import_contracts = require("./contracts");
var import_canonical = require("./canonical");
var import_errors = require("./errors");
const CAPABILITIES = /* @__PURE__ */ new Set(["chat", "structured-output", "reasoning"]);
const REQUEST_KEYS = /* @__PURE__ */ new Set([
  "requestId",
  "taskType",
  "privacyClass",
  "latencyClass",
  "promptTemplateId",
  "promptTemplateVersion",
  "responseContractId",
  "responseContractVersion",
  "evidence",
  "requiredCapabilities",
  "limits"
]);
const LIMIT_KEYS = /* @__PURE__ */ new Set(["timeoutMs", "maxOutputTokens"]);
function requireString(record, key, maxLength = 128) {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `${key} must be a non-empty string up to ${maxLength} characters`);
  }
  return value;
}
function optionalPositiveInteger(value, key, maximum) {
  if (value === void 0) {
    return void 0;
  }
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `${key} must be a positive integer up to ${maximum}`);
  }
  return value;
}
function parseAIRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new import_errors.GovernedError("INVALID_REQUEST", "Request must be an object");
  }
  const record = value;
  const unknownKey = Object.keys(record).find((key) => !REQUEST_KEYS.has(key));
  if (unknownKey) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `Unknown request field: ${unknownKey}`);
  }
  const taskType = requireString(record, "taskType");
  const privacyClass = requireString(record, "privacyClass");
  const latencyClass = requireString(record, "latencyClass");
  if (!import_contracts.TASK_TYPES.includes(taskType)) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `Unsupported taskType: ${taskType}`);
  }
  if (!import_contracts.PRIVACY_CLASSES.includes(privacyClass)) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `Unsupported privacyClass: ${privacyClass}`);
  }
  if (!import_contracts.LATENCY_CLASSES.includes(latencyClass)) {
    throw new import_errors.GovernedError("INVALID_REQUEST", `Unsupported latencyClass: ${latencyClass}`);
  }
  const requiredCapabilities = record.requiredCapabilities;
  let capabilities;
  if (requiredCapabilities !== void 0) {
    if (!Array.isArray(requiredCapabilities) || requiredCapabilities.length > 16) {
      throw new import_errors.GovernedError("INVALID_REQUEST", "requiredCapabilities must be an array of up to 16 entries");
    }
    capabilities = [
      ...new Set(
        requiredCapabilities.map((capability) => {
          if (typeof capability !== "string" || !CAPABILITIES.has(capability)) {
            throw new import_errors.GovernedError("INVALID_REQUEST", `Unsupported capability: ${String(capability)}`);
          }
          return capability;
        })
      )
    ];
  }
  let limits;
  if (record.limits !== void 0) {
    if (!record.limits || typeof record.limits !== "object" || Array.isArray(record.limits)) {
      throw new import_errors.GovernedError("INVALID_REQUEST", "limits must be an object");
    }
    const rawLimits = record.limits;
    const unknownLimit = Object.keys(rawLimits).find((key) => !LIMIT_KEYS.has(key));
    if (unknownLimit) {
      throw new import_errors.GovernedError("INVALID_REQUEST", `Unknown limits field: ${unknownLimit}`);
    }
    const timeoutMs = optionalPositiveInteger(rawLimits.timeoutMs, "limits.timeoutMs", 12e4);
    const maxOutputTokens = optionalPositiveInteger(rawLimits.maxOutputTokens, "limits.maxOutputTokens", 16384);
    if (timeoutMs !== void 0 || maxOutputTokens !== void 0) {
      limits = {
        ...timeoutMs !== void 0 ? { timeoutMs } : {},
        ...maxOutputTokens !== void 0 ? { maxOutputTokens } : {}
      };
    }
  }
  const evidence = record.evidence;
  const encodedEvidence = (0, import_canonical.canonicalize)(evidence);
  if (Buffer.byteLength(encodedEvidence, "utf8") > 64 * 1024) {
    throw new import_errors.GovernedError("REQUEST_TOO_LARGE", "Evidence exceeds 64 KiB");
  }
  return {
    requestId: requireString(record, "requestId", 128),
    taskType,
    privacyClass,
    latencyClass,
    promptTemplateId: requireString(record, "promptTemplateId"),
    promptTemplateVersion: requireString(record, "promptTemplateVersion", 32),
    responseContractId: requireString(record, "responseContractId"),
    responseContractVersion: requireString(record, "responseContractVersion", 32),
    evidence: structuredClone(evidence),
    ...capabilities ? { requiredCapabilities: capabilities } : {},
    ...limits ? { limits } : {}
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseAIRequest
});
//# sourceMappingURL=request-validation.js.map
