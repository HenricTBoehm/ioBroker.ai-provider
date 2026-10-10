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
var policy_exports = {};
__export(policy_exports, {
  AccessPolicy: () => AccessPolicy,
  ROUTE_POLICY_VERSION: () => ROUTE_POLICY_VERSION,
  selectRoute: () => selectRoute
});
module.exports = __toCommonJS(policy_exports);
var import_errors = require("./errors");
const ROUTE_POLICY_VERSION = "1";
class AccessPolicy {
  callers;
  userRequired;
  constructor(allowedCallers, requireUserForTaskTypes) {
    this.callers = new Set(allowedCallers);
    this.userRequired = new Set(requireUserForTaskTypes);
  }
  authorize(context, taskType) {
    this.authorizeCaller(context.callerInstance);
    if (this.userRequired.has(taskType) && !context.authenticatedUser) {
      throw new import_errors.GovernedError("USER_CONTEXT_REQUIRED", `Task type ${taskType} requires an authenticated user`);
    }
  }
  authorizeCaller(callerInstance) {
    if (!callerInstance.startsWith("system.adapter.") || !this.callers.has(callerInstance)) {
      throw new import_errors.GovernedError("CALLER_NOT_ALLOWED", `Caller ${callerInstance} is not allowed`);
    }
  }
}
function selectRoute(request, providers, health, now = Date.now()) {
  var _a;
  const required = new Set((_a = request.requiredCapabilities) != null ? _a : ["chat", "structured-output"]);
  const healthy = providers.filter((provider2) => {
    const snapshot = health.find((item) => item.provider === provider2.id);
    return (snapshot == null ? void 0 : snapshot.configured) && snapshot.available && snapshot.checkedAt <= now && snapshot.validUntil > now && [...required].every((capability) => provider2.capabilities.includes(capability));
  });
  const complex = ["COMPLEX_INTERPRETATION", "DIAGNOSIS", "PLANNING"].includes(request.taskType);
  const targetCloud = request.privacyClass !== "LOCAL_ONLY" && complex;
  const provider = healthy.find((candidate) => candidate.cloud === targetCloud);
  if (!provider) {
    throw new import_errors.GovernedError(
      "NO_ROUTABLE_PROVIDER",
      `No fresh, healthy ${targetCloud ? "cloud" : "local"} provider satisfies policy`,
      true
    );
  }
  const newestHealth = Math.max(...health.map((item) => item.checkedAt));
  return {
    provider,
    decision: {
      policyVersion: ROUTE_POLICY_VERSION,
      healthSnapshotTimestamp: newestHealth,
      provider: provider.id,
      model: provider.model,
      reason: targetCloud ? "complex task with cloud-permitted privacy class" : "local route required by privacy or task policy"
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccessPolicy,
  ROUTE_POLICY_VERSION,
  selectRoute
});
//# sourceMappingURL=policy.js.map
