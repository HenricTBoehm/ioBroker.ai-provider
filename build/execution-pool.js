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
var execution_pool_exports = {};
__export(execution_pool_exports, {
  ExecutionPool: () => ExecutionPool
});
module.exports = __toCommonJS(execution_pool_exports);
var import_errors = require("./errors");
class ExecutionPool {
  constructor(concurrency, maxQueue) {
    this.concurrency = concurrency;
    this.maxQueue = maxQueue;
  }
  active = 0;
  queue = [];
  closed = false;
  async run(operation) {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }
  close() {
    this.closed = true;
    for (const task of this.queue.splice(0)) {
      task.reject(new import_errors.GovernedError("ADAPTER_UNLOADING", "Adapter is unloading", true));
    }
  }
  acquire() {
    if (this.closed) {
      return Promise.reject(new import_errors.GovernedError("ADAPTER_UNLOADING", "Adapter is unloading", true));
    }
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new import_errors.GovernedError("QUEUE_FULL", "Inference queue is full", true));
    }
    return new Promise(
      (resolve, reject) => this.queue.push({
        resolve: () => {
          this.active++;
          resolve();
        },
        reject
      })
    );
  }
  release() {
    var _a;
    this.active--;
    (_a = this.queue.shift()) == null ? void 0 : _a.resolve();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ExecutionPool
});
//# sourceMappingURL=execution-pool.js.map
