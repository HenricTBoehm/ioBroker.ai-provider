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
var openai_compatible_exports = {};
__export(openai_compatible_exports, {
  OpenAICompatibleProvider: () => OpenAICompatibleProvider
});
module.exports = __toCommonJS(openai_compatible_exports);
var import_errors = require("../errors");
class OpenAICompatibleProvider {
  constructor(config) {
    this.config = config;
    this.id = config.id;
    this.model = config.model;
    this.cloud = config.cloud;
  }
  capabilities = ["chat", "structured-output", "reasoning"];
  id;
  model;
  cloud;
  cachedHealth;
  url(path) {
    return `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
  }
  headers() {
    return {
      "content-type": "application/json",
      ...this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}
    };
  }
  isConfigured() {
    return this.config.enabled && this.config.baseUrl.length > 0 && this.config.model.length > 0;
  }
  async health(signal) {
    const now = Date.now();
    if (this.cachedHealth && this.cachedHealth.validUntil > now) {
      return this.cachedHealth;
    }
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        configured: false,
        available: false,
        checkedAt: now,
        validUntil: now + this.config.healthTtlMs
      };
    }
    try {
      const response = await fetch(this.url("/models"), { headers: this.headers(), signal });
      this.cachedHealth = {
        provider: this.id,
        configured: true,
        available: response.ok,
        checkedAt: now,
        validUntil: now + this.config.healthTtlMs,
        detail: response.ok ? void 0 : `HTTP ${response.status}`
      };
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      this.cachedHealth = {
        provider: this.id,
        configured: true,
        available: false,
        checkedAt: now,
        validUntil: now + this.config.healthTtlMs,
        detail: error instanceof Error ? error.message : "Health check failed"
      };
    }
    return this.cachedHealth;
  }
  async listModels(signal) {
    var _a;
    if (!this.isConfigured()) {
      return [];
    }
    const response = await fetch(this.url("/models"), { headers: this.headers(), signal });
    if (!response.ok) {
      throw new import_errors.GovernedError("PROVIDER_UNAVAILABLE", `${this.id} returned HTTP ${response.status}`, true);
    }
    const body = await response.json();
    return ((_a = body.data) != null ? _a : []).flatMap((item) => typeof item.id === "string" ? [item.id] : []);
  }
  async generate(request, signal) {
    var _a, _b, _c, _d, _e;
    if (!this.isConfigured()) {
      throw new import_errors.GovernedError("PROVIDER_NOT_CONFIGURED", `${this.id} is disabled or incomplete`);
    }
    const response = await fetch(this.url("/chat/completions"), {
      method: "POST",
      headers: this.headers(),
      signal,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: JSON.stringify(request.input) }
        ],
        max_tokens: request.maxOutputTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: "governed_response", strict: true, schema: request.outputSchema }
        }
      })
    });
    if (!response.ok) {
      throw new import_errors.GovernedError(
        "PROVIDER_REQUEST_FAILED",
        `${this.id} returned HTTP ${response.status}`,
        response.status >= 500
      );
    }
    const body = await response.json();
    const content = (_c = (_b = (_a = body.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
    if (typeof content !== "string") {
      throw new import_errors.GovernedError("INVALID_PROVIDER_RESPONSE", `${this.id} returned no text content`);
    }
    return {
      provider: this.id,
      model: this.model,
      rawText: content,
      usage: { inputTokens: (_d = body.usage) == null ? void 0 : _d.prompt_tokens, outputTokens: (_e = body.usage) == null ? void 0 : _e.completion_tokens }
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OpenAICompatibleProvider
});
//# sourceMappingURL=openai-compatible.js.map
