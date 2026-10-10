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
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var prompt_registry_exports = {};
__export(prompt_registry_exports, {
  PromptRegistry: () => PromptRegistry
});
module.exports = __toCommonJS(prompt_registry_exports);
var import_errors = require("../errors");
const DEFINITIONS = [
  {
    id: "smarthome.climate-diagnosis",
    version: "1",
    allowedTaskTypes: ["DIAGNOSIS"],
    disclosureProfileId: "smarthome.climate-diagnosis",
    disclosureProfileVersion: "1",
    systemPrompt: [
      "Assess only the supplied climate evidence.",
      "Distinguish confirmed findings from uncertainty.",
      "Do not claim that any action was executed.",
      "Do not invent missing measurements.",
      "Return exactly one JSON object matching the supplied response schema."
    ].join(" ")
  },
  {
    id: "smarthome.interpretation",
    version: "1",
    allowedTaskTypes: ["SIMPLE_INTERPRETATION", "COMPLEX_INTERPRETATION"],
    disclosureProfileId: "smarthome.interpretation",
    disclosureProfileVersion: "1",
    systemPrompt: [
      "Interpret only the supplied smart-home evidence.",
      "Do not claim that any action was executed.",
      "Do not invent missing evidence.",
      "Return exactly one JSON object matching the supplied response schema."
    ].join(" ")
  }
];
function key(id, version) {
  return `${id}@${version}`;
}
class PromptRegistry {
  definitions = new Map(
    DEFINITIONS.map((definition) => [key(definition.id, definition.version), definition])
  );
  resolve(id, version, taskType) {
    const definition = this.definitions.get(key(id, version));
    if (!definition) {
      throw new import_errors.GovernedError("UNKNOWN_PROMPT_TEMPLATE", `Unknown prompt template ${id}@${version}`);
    }
    if (!definition.allowedTaskTypes.includes(taskType)) {
      throw new import_errors.GovernedError(
        "PROMPT_TASK_MISMATCH",
        `Prompt ${id}@${version} does not allow task type ${taskType}`
      );
    }
    return definition;
  }
  list() {
    return [...this.definitions.values()].map(({ id, version }) => ({ id, version }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PromptRegistry
});
//# sourceMappingURL=prompt-registry.js.map
