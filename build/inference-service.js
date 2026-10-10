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
var inference_service_exports = {};
__export(inference_service_exports, {
  InferenceService: () => InferenceService
});
module.exports = __toCommonJS(inference_service_exports);
var import_crypto = require("crypto");
var import_canonical = require("./canonical");
var import_errors = require("./errors");
var import_execution_pool = require("./execution-pool");
var import_policy = require("./policy");
var import_disclosure_registry = require("./registries/disclosure-registry");
var import_prompt_registry = require("./registries/prompt-registry");
var import_response_contract_registry = require("./registries/response-contract-registry");
var import_request_ledger = require("./request-ledger");
var import_request_validation = require("./request-validation");
class InferenceService {
  constructor(options) {
    this.options = options;
    this.ledger = new import_request_ledger.RequestLedger(options.idempotencyTtlMs, options.maxRequestRecords);
    this.pool = new import_execution_pool.ExecutionPool(options.maxConcurrency, options.maxQueue);
  }
  prompts = new import_prompt_registry.PromptRegistry();
  contracts = new import_response_contract_registry.ResponseContractRegistry();
  disclosures = new import_disclosure_registry.DisclosureRegistry();
  ledger;
  pool;
  unloadController = new AbortController();
  generate(rawRequest, context) {
    const request = (0, import_request_validation.parseAIRequest)(rawRequest);
    this.options.accessPolicy.authorize(context, request.taskType);
    const digest = (0, import_canonical.requestDigest)(request);
    return this.ledger.run(
      `${context.callerInstance}\0${request.requestId}`,
      digest,
      () => this.pool.run(() => this.execute(request, context, digest))
    );
  }
  capabilities(caller) {
    this.options.accessPolicy.authorizeCaller(caller);
    return {
      routePolicyVersion: import_policy.ROUTE_POLICY_VERSION,
      prompts: this.prompts.list(),
      responseContracts: this.contracts.list(),
      disclosureProfiles: this.disclosures.list(),
      providers: this.options.providers.map((provider) => ({
        id: provider.id,
        model: provider.model,
        cloud: provider.cloud,
        capabilities: [...provider.capabilities]
      }))
    };
  }
  async health(caller) {
    this.options.accessPolicy.authorizeCaller(caller);
    return this.withSignal((signal) => Promise.all(this.options.providers.map((provider) => provider.health(signal))));
  }
  async listModels(caller) {
    this.options.accessPolicy.authorizeCaller(caller);
    return this.withSignal(
      async (signal) => Object.fromEntries(
        await Promise.all(
          this.options.providers.map(
            async (provider) => [provider.id, await provider.listModels(signal)]
          )
        )
      )
    );
  }
  shutdown() {
    this.pool.close();
    this.unloadController.abort(new import_errors.GovernedError("ADAPTER_UNLOADING", "Adapter is unloading", true));
  }
  async execute(request, context, digest) {
    var _a, _b, _c, _d, _e, _f;
    const startedAt = Date.now();
    let audit = {
      requestId: request.requestId,
      caller: context.callerInstance,
      userDigest: context.authenticatedUser ? (0, import_canonical.sha256)(context.authenticatedUser) : void 0,
      taskType: request.taskType,
      privacyClass: request.privacyClass,
      promptTemplate: `${request.promptTemplateId}@${request.promptTemplateVersion}`,
      responseContract: `${request.responseContractId}@${request.responseContractVersion}`,
      disclosureProfile: "NOT_RESOLVED",
      requestDigest: digest,
      routePolicyVersion: import_policy.ROUTE_POLICY_VERSION,
      startedAt,
      finishedAt: startedAt,
      latencyMs: 0,
      validationResult: "NOT_RUN"
    };
    try {
      const prompt = this.prompts.resolve(
        request.promptTemplateId,
        request.promptTemplateVersion,
        request.taskType
      );
      const contract = this.contracts.resolve(request.responseContractId, request.responseContractVersion);
      const disclosed = this.disclosures.project(
        prompt.disclosureProfileId,
        prompt.disclosureProfileVersion,
        request.evidence
      );
      audit = {
        ...audit,
        disclosureProfile: `${prompt.disclosureProfileId}@${prompt.disclosureProfileVersion}`,
        disclosedEvidenceDigest: (0, import_canonical.valueDigest)("ai-provider-disclosed-evidence:v1", disclosed)
      };
      const result = await this.withSignal(async (signal) => {
        var _a2, _b2;
        const health = await Promise.all(this.options.providers.map((provider) => provider.health(signal)));
        const route = (0, import_policy.selectRoute)(request, this.options.providers, health);
        audit = {
          ...audit,
          provider: route.provider.id,
          model: route.provider.model,
          healthSnapshotTimestamp: route.decision.healthSnapshotTimestamp,
          routingReason: route.decision.reason
        };
        const generated = await route.provider.generate(
          {
            requestId: request.requestId,
            systemPrompt: prompt.systemPrompt,
            input: disclosed,
            outputSchema: contract.jsonSchema,
            maxOutputTokens: (_b2 = (_a2 = request.limits) == null ? void 0 : _a2.maxOutputTokens) != null ? _b2 : 1024
          },
          signal
        );
        const output = this.contracts.validate(contract, generated.rawText);
        return { route: route.decision, generated, output };
      }, (_a = request.limits) == null ? void 0 : _a.timeoutMs);
      const finishedAt = Date.now();
      audit = {
        ...audit,
        finishedAt,
        latencyMs: finishedAt - startedAt,
        validationResult: "PASSED",
        inputTokens: (_b = result.generated.usage) == null ? void 0 : _b.inputTokens,
        outputTokens: (_c = result.generated.usage) == null ? void 0 : _c.outputTokens
      };
      return {
        requestId: request.requestId,
        ok: true,
        output: result.output,
        route: result.route,
        attempts: [{ attemptId: (0, import_crypto.randomUUID)(), type: "generation", validationResult: "PASSED" }],
        repaired: false,
        usage: result.generated.usage,
        latencyMs: audit.latencyMs
      };
    } catch (error) {
      const normalized = error instanceof DOMException && error.name === "TimeoutError" ? new import_errors.GovernedError("REQUEST_TIMEOUT", "Inference request timed out", true) : error;
      const finishedAt = Date.now();
      const responseError = (0, import_errors.errorResponse)(normalized);
      audit = {
        ...audit,
        finishedAt,
        latencyMs: finishedAt - startedAt,
        validationResult: responseError.code === "SCHEMA_VALIDATION_FAILED" ? "FAILED" : "NOT_RUN",
        errorCode: responseError.code
      };
      return {
        requestId: request.requestId,
        ok: false,
        route: audit.provider ? {
          policyVersion: import_policy.ROUTE_POLICY_VERSION,
          healthSnapshotTimestamp: (_d = audit.healthSnapshotTimestamp) != null ? _d : 0,
          provider: audit.provider,
          model: (_e = audit.model) != null ? _e : "",
          reason: (_f = audit.routingReason) != null ? _f : ""
        } : void 0,
        attempts: audit.validationResult === "FAILED" ? [{ attemptId: (0, import_crypto.randomUUID)(), type: "generation", validationResult: "FAILED" }] : void 0,
        latencyMs: audit.latencyMs,
        error: responseError
      };
    } finally {
      this.options.audit(audit);
    }
  }
  async withSignal(operation, timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs != null ? timeoutMs : this.options.requestTimeoutMs);
    return operation(AbortSignal.any([this.unloadController.signal, timeout]));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InferenceService
});
//# sourceMappingURL=inference-service.js.map
