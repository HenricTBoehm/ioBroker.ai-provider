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
var request_ledger_exports = {};
__export(request_ledger_exports, {
  RequestLedger: () => RequestLedger
});
module.exports = __toCommonJS(request_ledger_exports);
var import_errors = require("./errors");
class RequestLedger {
  constructor(ttlMs, maxRecords) {
    this.ttlMs = ttlMs;
    this.maxRecords = maxRecords;
  }
  records = /* @__PURE__ */ new Map();
  run(key, digest, operation) {
    this.prune();
    const existing = this.records.get(key);
    if (existing) {
      if (existing.digest !== digest) {
        throw new import_errors.GovernedError("REQUEST_ID_REUSE_MISMATCH", "requestId was reused with a different payload");
      }
      return existing.promise;
    }
    if (this.records.size >= this.maxRecords) {
      this.records.delete(this.records.keys().next().value);
    }
    const promise = operation();
    this.records.set(key, { digest, createdAt: Date.now(), promise });
    return promise;
  }
  prune(now = Date.now()) {
    for (const [key, record] of this.records) {
      if (record.createdAt + this.ttlMs <= now) {
        this.records.delete(key);
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RequestLedger
});
//# sourceMappingURL=request-ledger.js.map
