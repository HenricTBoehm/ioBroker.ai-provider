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
var errors_exports = {};
__export(errors_exports, {
  GovernedError: () => GovernedError,
  errorResponse: () => errorResponse
});
module.exports = __toCommonJS(errors_exports);
class GovernedError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.name = "GovernedError";
  }
}
function errorResponse(error) {
  if (error instanceof GovernedError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown internal error",
    retryable: false
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GovernedError,
  errorResponse
});
//# sourceMappingURL=errors.js.map
