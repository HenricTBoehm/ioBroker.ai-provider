![Logo](admin/ai-provider.png)

# ioBroker.ai-provider

A governed inference provider for ioBroker. It routes explicitly scoped requests to a local OpenAI-compatible endpoint or OpenAI without granting either model access to ioBroker states, objects, aliases, or actuators.

## Authority boundary

```text
AIRequest
  -> caller and optional user policy
  -> runtime validation
  -> versioned prompt and response contracts
  -> deterministic route policy + fresh provider health
  -> typed disclosure projection
  -> model inference
  -> strict output validation
  -> AIResponse (proposal only)
```

The adapter has no effect path. A downstream consumer must treat every `AIResponse` as untrusted input and apply a separate effect policy and authority check before any action.

## Message API

Enable only trusted, canonical adapter callers such as `system.adapter.javascript.0`. The adapter exposes four custom messages:

- `generate`
- `health`
- `capabilities`
- `listModels`

Example:

```javascript
sendTo('ai-provider.0', 'generate', {
    requestId: 'climate-2026-10-10T12:00:00Z',
    taskType: 'DIAGNOSIS',
    privacyClass: 'CLOUD_REDACTED',
    latencyClass: 'NORMAL',
    promptTemplateId: 'smarthome.climate-diagnosis',
    promptTemplateVersion: '1',
    responseContractId: 'smarthome.assessment-result',
    responseContractVersion: '1',
    requiredCapabilities: ['chat', 'structured-output'],
    evidence: {
        room: { name: 'Wintergarten' },
        climate: { temperature: 28.4, humidity: 51 },
        outside: { temperature: 21.7 },
        window: { open: false },
        evidenceTimestamp: '2026-10-10T12:00:00Z'
    }
}, response => {
    // This is an interpretation/proposal, never effect authorization.
    log(JSON.stringify(response));
});
```

The public contract intentionally has no provider, model, system prompt, or arbitrary response schema fields. Routing and model selection are local policy decisions.

## Governance behavior

- A request ID is idempotent only for the same canonical request digest and caller.
- Reusing it with another payload returns `REQUEST_ID_REUSE_MISMATCH`.
- `LOCAL_ONLY` can never route to a cloud provider.
- Complex cloud-permitted tasks route to the configured cloud provider; simple tasks remain local.
- Provider availability is accepted only while its health snapshot is fresh.
- Providers receive only the projected `ModelRequest`, not caller, user, privacy class, or original evidence.
- Structured output is parsed and schema-validated fail closed.
- Timeouts and adapter unload abort active requests.
- Audit logs contain metadata and digests, never evidence, prompts, outputs, or API keys.

No silent cloud fallback or output-repair attempt exists in v0.1.

## Development

```bash
npm install
npm run check
npm run lint
npm test
npm run build
```

## Changelog

### **WORK IN PROGRESS**

- Initial governed provider skeleton.

## License

MIT License

Copyright (c) 2026 Henric T. Boehm
