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
var canonical_exports = {};
__export(canonical_exports, {
  canonicalize: () => canonicalize,
  requestDigest: () => requestDigest,
  sha256: () => sha256,
  valueDigest: () => valueDigest
});
module.exports = __toCommonJS(canonical_exports);
var import_node_crypto = require("node:crypto");
var import_errors = require("./errors");
function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index++) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 55296 && codeUnit <= 56319) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 56320 && next <= 57343)) {
        throw new import_errors.GovernedError("INVALID_JSON_VALUE", "Lone UTF-16 surrogates are not allowed");
      }
      index++;
    } else if (codeUnit >= 56320 && codeUnit <= 57343) {
      throw new import_errors.GovernedError("INVALID_JSON_VALUE", "Lone UTF-16 surrogates are not allowed");
    }
  }
}
function canonicalize(value) {
  const seen = /* @__PURE__ */ new Set();
  const visit = (current) => {
    if (current === null) {
      return "null";
    }
    if (typeof current === "string") {
      assertValidUnicode(current);
      return JSON.stringify(current);
    }
    if (typeof current === "boolean") {
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new import_errors.GovernedError("INVALID_JSON_VALUE", "Non-finite numbers are not allowed");
      }
      return JSON.stringify(current);
    }
    if (Array.isArray(current)) {
      if (seen.has(current)) {
        throw new import_errors.GovernedError("CYCLIC_REQUEST", "Cyclic request values are not allowed");
      }
      seen.add(current);
      const result = `[${current.map(visit).join(",")}]`;
      seen.delete(current);
      return result;
    }
    if (typeof current === "object") {
      if (seen.has(current)) {
        throw new import_errors.GovernedError("CYCLIC_REQUEST", "Cyclic request values are not allowed");
      }
      seen.add(current);
      const record = current;
      const keys = Object.keys(record).sort();
      keys.forEach(assertValidUnicode);
      const result = `{${keys.map((key) => `${JSON.stringify(key)}:${visit(record[key])}`).join(",")}}`;
      seen.delete(current);
      return result;
    }
    throw new import_errors.GovernedError("INVALID_JSON_VALUE", `Unsupported JSON value type: ${typeof current}`);
  };
  return visit(value);
}
function sha256(value) {
  return (0, import_node_crypto.createHash)("sha256").update(value, "utf8").digest("hex");
}
function requestDigest(request) {
  const { requestId: _requestId, ...governedFields } = request;
  return sha256(`ai-provider-request:v1\0${canonicalize(governedFields)}`);
}
function valueDigest(domain, value) {
  return sha256(`${domain}\0${canonicalize(value)}`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  canonicalize,
  requestDigest,
  sha256,
  valueDigest
});
//# sourceMappingURL=canonical.js.map
