import { createHash } from 'node:crypto';

import type { AIRequest } from './contracts';
import { GovernedError } from './errors';

export function canonicalize(value: unknown): string {
	const seen = new Set<object>();

	const visit = (current: unknown): string => {
		if (current === null) {
			return 'null';
		}
		if (typeof current === 'string' || typeof current === 'boolean') {
			return JSON.stringify(current);
		}

		if (typeof current === 'number') {
			if (!Number.isFinite(current)) {
				throw new GovernedError('INVALID_JSON_VALUE', 'Non-finite numbers are not allowed');
			}
			return JSON.stringify(current);
		}

		if (Array.isArray(current)) {
			if (seen.has(current)) {
				throw new GovernedError('CYCLIC_REQUEST', 'Cyclic request values are not allowed');
			}
			seen.add(current);
			const result = `[${current.map(visit).join(',')}]`;
			seen.delete(current);
			return result;
		}

		if (typeof current === 'object') {
			if (seen.has(current)) {
				throw new GovernedError('CYCLIC_REQUEST', 'Cyclic request values are not allowed');
			}
			seen.add(current);
			const record = current as Record<string, unknown>;
			const keys = Object.keys(record).sort();
			const result = `{${keys.map(key => `${JSON.stringify(key)}:${visit(record[key])}`).join(',')}}`;
			seen.delete(current);
			return result;
		}

		throw new GovernedError('INVALID_JSON_VALUE', `Unsupported JSON value type: ${typeof current}`);
	};

	return visit(value);
}

export function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function requestDigest(request: AIRequest): string {
	const { requestId: _requestId, ...governedFields } = request;
	return sha256(`ai-provider-request:v1\0${canonicalize(governedFields)}`);
}

export function valueDigest(domain: string, value: unknown): string {
	return sha256(`${domain}\0${canonicalize(value)}`);
}
