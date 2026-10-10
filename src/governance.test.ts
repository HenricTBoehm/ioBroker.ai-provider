import { strict as assert } from 'node:assert';

import { canonicalize, requestDigest } from './canonical';
import type { AIRequest, ModelRequest, ModelResult, ProviderHealthSnapshot } from './contracts';
import { GovernedError } from './errors';
import { type AuditMetadata, InferenceService } from './inference-service';
import { AccessPolicy, selectRoute } from './policy';
import type { AIProvider } from './providers/provider';
import { DisclosureRegistry } from './registries/disclosure-registry';
import { ResponseContractRegistry } from './registries/response-contract-registry';
import { RequestLedger } from './request-ledger';
import { parseAIRequest } from './request-validation';

const BASE_REQUEST: AIRequest = {
	requestId: 'request-1',
	taskType: 'DIAGNOSIS',
	privacyClass: 'LOCAL_ONLY',
	latencyClass: 'NORMAL',
	promptTemplateId: 'smarthome.climate-diagnosis',
	promptTemplateVersion: '1',
	responseContractId: 'smarthome.assessment-result',
	responseContractVersion: '1',
	evidence: { room: { name: 'Wintergarten' } },
};

class FakeProvider implements AIProvider {
	public readonly capabilities = ['chat', 'structured-output', 'reasoning'] as const;
	public constructor(
		public readonly id: string,
		public readonly model: string,
		public readonly cloud: boolean,
	) {}
	public health(): Promise<ProviderHealthSnapshot> {
		throw new Error('not used');
	}
	public generate(_request: ModelRequest, _signal: AbortSignal): Promise<ModelResult> {
		throw new Error('not used');
	}
	public listModels(): Promise<string[]> {
		throw new Error('not used');
	}
}

class CapturingProvider implements AIProvider {
	public readonly id = 'local';
	public readonly model = 'qwen';
	public readonly cloud = false;
	public readonly capabilities = ['chat', 'structured-output'] as const;
	public received?: ModelRequest;

	public health(): Promise<ProviderHealthSnapshot> {
		const now = Date.now();
		return Promise.resolve({
			provider: this.id,
			configured: true,
			available: true,
			checkedAt: now,
			validUntil: now + 10_000,
		});
	}

	public generate(request: ModelRequest): Promise<ModelResult> {
		this.received = request;
		return Promise.resolve({
			provider: this.id,
			model: this.model,
			rawText: JSON.stringify({
				classification: 'NORMAL',
				summary: 'No anomaly in disclosed evidence.',
				recommendations: [],
				confidence: 0.8,
			}),
		});
	}

	public listModels(): Promise<string[]> {
		return Promise.resolve([this.model]);
	}
}

describe('governance primitives', () => {
	it('canonicalizes object keys and makes requestId independent digests', () => {
		assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
		assert.equal(requestDigest(BASE_REQUEST), requestDigest({ ...BASE_REQUEST, requestId: 'retry-id' }));
	});

	it('rejects caller-selected provider, model, prompt, and schema fields', () => {
		for (const field of ['preferredProvider', 'preferredModel', 'systemPrompt', 'responseSchema']) {
			assert.throws(
				() => parseAIRequest({ ...BASE_REQUEST, [field]: 'forbidden' }),
				(error: unknown) => error instanceof GovernedError && error.code === 'INVALID_REQUEST',
			);
		}
	});

	it('rejects requestId reuse with a different digest', async () => {
		const ledger = new RequestLedger(10_000, 10);
		await ledger.run('caller\0id', 'digest-a', () => Promise.resolve({ requestId: 'id', ok: true }));
		assert.throws(
			() => ledger.run('caller\0id', 'digest-b', () => Promise.resolve({ requestId: 'id', ok: true })),
			(error: unknown) => error instanceof GovernedError && error.code === 'REQUEST_ID_REUSE_MISMATCH',
		);
	});

	it('projects only explicit nested disclosure paths', () => {
		const projected = new DisclosureRegistry().project('smarthome.climate-diagnosis', '1', {
			room: { name: 'Wintergarten', owner: 'private', cameraUrl: 'private' },
			climate: { temperature: 28.4, rawDeviceTree: 'private' },
			wifiPassword: 'private',
		});
		assert.deepEqual(projected, { room: { name: 'Wintergarten' }, climate: { temperature: 28.4 } });
	});

	it('fails closed when structured output is invalid', () => {
		const registry = new ResponseContractRegistry();
		const contract = registry.resolve('smarthome.assessment-result', '1');
		assert.throws(
			() => registry.validate(contract, 'not json'),
			(error: unknown) => error instanceof GovernedError && error.code === 'SCHEMA_VALIDATION_FAILED',
		);
	});

	it('keeps caller and user policy separate', () => {
		const policy = new AccessPolicy(['system.adapter.javascript.0'], ['DIAGNOSIS']);
		assert.throws(
			() => policy.authorize({ callerInstance: 'system.adapter.javascript.0' }, 'DIAGNOSIS'),
			(error: unknown) => error instanceof GovernedError && error.code === 'USER_CONTEXT_REQUIRED',
		);
		policy.authorize(
			{ callerInstance: 'system.adapter.javascript.0', authenticatedUser: 'system.user.admin' },
			'DIAGNOSIS',
		);
		assert.throws(
			() => policy.authorizeCaller('javascript.0'),
			(error: unknown) => error instanceof GovernedError && error.code === 'CALLER_NOT_ALLOWED',
		);
	});

	it('never routes LOCAL_ONLY to cloud and rejects stale health', () => {
		const now = 10_000;
		const local = new FakeProvider('local', 'qwen', false);
		const cloud = new FakeProvider('openai', 'gpt', true);
		const fresh = (provider: string): ProviderHealthSnapshot => ({
			provider,
			configured: true,
			available: true,
			checkedAt: now - 10,
			validUntil: now + 1_000,
		});
		assert.equal(
			selectRoute(BASE_REQUEST, [cloud, local], [fresh('openai'), fresh('local')], now).provider.id,
			'local',
		);
		assert.throws(
			() => selectRoute(BASE_REQUEST, [local], [{ ...fresh('local'), validUntil: now }], now),
			(error: unknown) => error instanceof GovernedError && error.code === 'NO_ROUTABLE_PROVIDER',
		);
	});

	it('never gives a provider the original evidence and audits metadata only', async () => {
		const provider = new CapturingProvider();
		const audits: AuditMetadata[] = [];
		const service = new InferenceService({
			providers: [provider],
			accessPolicy: new AccessPolicy(['system.adapter.javascript.0'], []),
			requestTimeoutMs: 1_000,
			maxConcurrency: 1,
			maxQueue: 1,
			idempotencyTtlMs: 10_000,
			maxRequestRecords: 10,
			audit: metadata => audits.push(metadata),
		});
		const response = await service.generate(
			{
				...BASE_REQUEST,
				evidence: {
					room: { name: 'Wintergarten', owner: 'private' },
					climate: { temperature: 28.4 },
					wifiPassword: 'private',
				},
			},
			{ callerInstance: 'system.adapter.javascript.0' },
		);

		assert.equal(response.ok, true);
		assert.deepEqual(provider.received?.input, {
			room: { name: 'Wintergarten' },
			climate: { temperature: 28.4 },
		});
		assert.equal(JSON.stringify(provider.received).includes('private'), false);
		assert.equal(JSON.stringify(audits).includes('Wintergarten'), false);
		assert.equal(JSON.stringify(audits).includes('wifiPassword'), false);
		service.shutdown();
	});
});
