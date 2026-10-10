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
var disclosure_registry_exports = {};
__export(disclosure_registry_exports, {
  DisclosureRegistry: () => DisclosureRegistry
});
module.exports = __toCommonJS(disclosure_registry_exports);
var import_errors = require("../errors");
const PROFILES = [
  {
    id: "smarthome.climate-diagnosis",
    version: "1",
    paths: [
      "room.name",
      "climate.temperature",
      "climate.humidity",
      "outside.temperature",
      "window.open",
      "evidenceTimestamp"
    ]
  },
  {
    id: "smarthome.interpretation",
    version: "1",
    paths: [
      "subject.type",
      "subject.name",
      "facts.value",
      "facts.unit",
      "facts.timestamp",
      "finding.classification",
      "finding.summary",
      "evidenceTimestamp"
    ]
  }
];
const UNSAFE_SEGMENTS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function key(id, version) {
  return `${id}@${version}`;
}
function readPath(source, segments) {
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return { found: false };
    }
    const record = current;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return { found: false };
    }
    current = record[segment];
  }
  return { found: true, value: current };
}
function writePath(target, segments, value) {
  let current = target;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const existing = current[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[segments.at(-1)] = structuredClone(value);
}
class DisclosureRegistry {
  profiles = new Map(PROFILES.map((profile) => [key(profile.id, profile.version), profile]));
  project(id, version, evidence) {
    const profile = this.profiles.get(key(id, version));
    if (!profile) {
      throw new import_errors.GovernedError("UNKNOWN_DISCLOSURE_PROFILE", `Unknown disclosure profile ${id}@${version}`);
    }
    const result = {};
    for (const path of profile.paths) {
      const segments = path.split(".");
      if (segments.some((segment) => UNSAFE_SEGMENTS.has(segment))) {
        throw new import_errors.GovernedError("INVALID_DISCLOSURE_PROFILE", `Unsafe disclosure path: ${path}`);
      }
      const selected = readPath(evidence, segments);
      if (selected.found) {
        writePath(result, segments, selected.value);
      }
    }
    return result;
  }
  list() {
    return [...this.profiles.values()].map(({ id, version }) => ({ id, version }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DisclosureRegistry
});
//# sourceMappingURL=disclosure-registry.js.map
