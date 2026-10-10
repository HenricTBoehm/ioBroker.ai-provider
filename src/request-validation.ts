import { LATENCY_CLASSES, PRIVACY_CLASSES, TASK_TYPES, type AIRequest, type Capability } from './contracts';
import { canonicalize } from './canonical';
import { GovernedError } from './errors';

const CAPABILITIES = new Set<Capability>(['chat', 'structured-output', 'reasoning']);
const REQUEST_KEYS = new Set([
	'requestId',
	'taskType',
	'privacyClass',
	'latencyClass',
	'promptTemplateId',
	'promptTemplateVersion',
	'responseContractId',
	'responseContractVersion',
	'evidence',
	'requiredCapabilities',
	'limits',
]);
const LIMIT_KEYS = new Set(['timeoutMs', 'maxOutputTokens']);

function requireString(record: Record<string, unknown>, key: string, maxLength = 128): string {
	const value = record[key];
	if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
		throw new GovernedError('INVALID_REQUEST', `${key} must be a non-empty string up to ${maxLength} characters`);
	}
	return value;
}

function optionalPositiveInteger(value: unknown, key: string, maximum: number): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > maximum) {
		throw new GovernedError('INVALID_REQUEST', `${key} must be a positive integer up to ${maximum}`);
	}
	return value as number;
}

export function parseAIRequest(value: unknown): AIRequest {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new GovernedError('INVALID_REQUEST', 'Request must be an object');
	}

	const record = value as Record<string, unknown>;
	const unknownKey = Object.keys(record).find(key => !REQUEST_KEYS.has(key));
	if (unknownKey) {
		throw new GovernedError('INVALID_REQUEST', `Unknown request field: ${unknownKey}`);
	}
	const taskType = requireString(record, 'taskType') as AIRequest['taskType'];
	const privacyClass = requireString(record, 'privacyClass') as AIRequest['privacyClass'];
	const latencyClass = requireString(record, 'latencyClass') as AIRequest['latencyClass'];

	if (!TASK_TYPES.includes(taskType)) {
		throw new GovernedError('INVALID_REQUEST', `Unsupported taskType: ${taskType}`);
	}
	if (!PRIVACY_CLASSES.includes(privacyClass)) {
		throw new GovernedError('INVALID_REQUEST', `Unsupported privacyClass: ${privacyClass}`);
	}
	if (!LATENCY_CLASSES.includes(latencyClass)) {
		throw new GovernedError('INVALID_REQUEST', `Unsupported latencyClass: ${latencyClass}`);
	}

	const requiredCapabilities = record.requiredCapabilities;
	let capabilities: Capability[] | undefined;
	if (requiredCapabilities !== undefined) {
		if (!Array.isArray(requiredCapabilities) || requiredCapabilities.length > 16) {
			throw new GovernedError('INVALID_REQUEST', 'requiredCapabilities must be an array of up to 16 entries');
		}
		capabilities = [
			...new Set(
				requiredCapabilities.map(capability => {
					if (typeof capability !== 'string' || !CAPABILITIES.has(capability as Capability)) {
						throw new GovernedError('INVALID_REQUEST', `Unsupported capability: ${String(capability)}`);
					}
					return capability as Capability;
				}),
			),
		];
	}

	let limits: AIRequest['limits'];
	if (record.limits !== undefined) {
		if (!record.limits || typeof record.limits !== 'object' || Array.isArray(record.limits)) {
			throw new GovernedError('INVALID_REQUEST', 'limits must be an object');
		}
		const rawLimits = record.limits as Record<string, unknown>;
		const unknownLimit = Object.keys(rawLimits).find(key => !LIMIT_KEYS.has(key));
		if (unknownLimit) {
			throw new GovernedError('INVALID_REQUEST', `Unknown limits field: ${unknownLimit}`);
		}
		const timeoutMs = optionalPositiveInteger(rawLimits.timeoutMs, 'limits.timeoutMs', 120_000);
		const maxOutputTokens = optionalPositiveInteger(rawLimits.maxOutputTokens, 'limits.maxOutputTokens', 16_384);
		if (timeoutMs !== undefined || maxOutputTokens !== undefined) {
			limits = {
				...(timeoutMs !== undefined ? { timeoutMs } : {}),
				...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
			};
		}
	}

	const evidence = record.evidence;
	const encodedEvidence = canonicalize(evidence);
	if (Buffer.byteLength(encodedEvidence, 'utf8') > 64 * 1024) {
		throw new GovernedError('REQUEST_TOO_LARGE', 'Evidence exceeds 64 KiB');
	}

	return {
		requestId: requireString(record, 'requestId', 128),
		taskType,
		privacyClass,
		latencyClass,
		promptTemplateId: requireString(record, 'promptTemplateId'),
		promptTemplateVersion: requireString(record, 'promptTemplateVersion', 32),
		responseContractId: requireString(record, 'responseContractId'),
		responseContractVersion: requireString(record, 'responseContractVersion', 32),
		evidence: structuredClone(evidence),
		...(capabilities ? { requiredCapabilities: capabilities } : {}),
		...(limits ? { limits } : {}),
	};
}
