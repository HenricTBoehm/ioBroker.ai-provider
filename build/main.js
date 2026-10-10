"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_contracts = require("./contracts");
var import_errors = require("./errors");
var import_inference_service = require("./inference-service");
var import_policy = require("./policy");
var import_openai_compatible = require("./providers/openai-compatible");
function csv(value = "") {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function taskTypes(value) {
  return csv(value).flatMap((value2) => import_contracts.TASK_TYPES.includes(value2) ? [value2] : []);
}
class AiProvider extends utils.Adapter {
  service;
  constructor(options = {}) {
    super({ ...options, name: "ai-provider" });
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  onReady() {
    var _a;
    const healthTtlMs = Math.max(1e3, this.config.healthTtlMs || 3e4);
    const providers = [
      new import_openai_compatible.OpenAICompatibleProvider({
        id: "local",
        cloud: false,
        enabled: this.config.localEnabled,
        baseUrl: this.config.localBaseUrl,
        model: this.config.localModel,
        apiKey: this.config.localApiKey,
        healthTtlMs
      }),
      new import_openai_compatible.OpenAICompatibleProvider({
        id: "openai",
        cloud: true,
        enabled: this.config.openAiEnabled,
        baseUrl: this.config.openAiBaseUrl,
        model: this.config.openAiModel,
        apiKey: this.config.openAiApiKey,
        healthTtlMs
      })
    ];
    this.service = new import_inference_service.InferenceService({
      providers,
      accessPolicy: new import_policy.AccessPolicy(
        csv(this.config.allowedCallers),
        taskTypes(this.config.requireUserForTaskTypes)
      ),
      requestTimeoutMs: Math.max(1e3, this.config.requestTimeoutMs || 3e4),
      maxConcurrency: Math.max(1, this.config.maxConcurrency || 2),
      maxQueue: Math.max(0, (_a = this.config.maxQueue) != null ? _a : 8),
      idempotencyTtlMs: Math.max(1e3, this.config.idempotencyTtlMs || 3e5),
      maxRequestRecords: Math.max(1, this.config.maxRequestRecords || 1e3),
      audit: (metadata) => this.audit(metadata)
    });
    this.log.info("Governed AI inference provider is ready; no state, object, or effect access is enabled");
  }
  async onMessage(message) {
    if (!message.callback) {
      return;
    }
    const envelope = message;
    const context = {
      callerInstance: message.from,
      authenticatedUser: typeof envelope.user === "string" ? envelope.user : void 0
    };
    try {
      if (!this.service) {
        throw new Error("Adapter is not ready");
      }
      let result;
      switch (message.command) {
        case "generate":
          result = await this.service.generate(message.message, context);
          break;
        case "health":
          result = await this.service.health(context.callerInstance);
          break;
        case "capabilities":
          result = this.service.capabilities(context.callerInstance);
          break;
        case "listModels":
          result = await this.service.listModels(context.callerInstance);
          break;
        default:
          result = {
            ok: false,
            error: {
              code: "UNKNOWN_COMMAND",
              message: `Unknown command ${message.command}`,
              retryable: false
            }
          };
      }
      this.sendTo(message.from, message.command, result, message.callback);
    } catch (error) {
      this.sendTo(message.from, message.command, { ok: false, error: (0, import_errors.errorResponse)(error) }, message.callback);
    }
  }
  audit(metadata) {
    this.log.info(`audit ${JSON.stringify(metadata)}`);
  }
  onUnload(callback) {
    var _a;
    try {
      (_a = this.service) == null ? void 0 : _a.shutdown();
    } finally {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new AiProvider(options);
} else {
  new AiProvider();
}
//# sourceMappingURL=main.js.map
