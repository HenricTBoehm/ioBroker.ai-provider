import type { AIResponse } from './contracts';
import { GovernedError } from './errors';

interface RequestRecord {
	digest: string;
	createdAt: number;
	promise: Promise<AIResponse>;
}

export class RequestLedger {
	private readonly records = new Map<string, RequestRecord>();

	public constructor(
		private readonly ttlMs: number,
		private readonly maxRecords: number,
	) {}

	public run(key: string, digest: string, operation: () => Promise<AIResponse>): Promise<AIResponse> {
		this.prune();
		const existing = this.records.get(key);
		if (existing) {
			if (existing.digest !== digest) {
				throw new GovernedError('REQUEST_ID_REUSE_MISMATCH', 'requestId was reused with a different payload');
			}
			return existing.promise;
		}
		if (this.records.size >= this.maxRecords) {
			this.records.delete(this.records.keys().next().value!);
		}
		const promise = operation();
		this.records.set(key, { digest, createdAt: Date.now(), promise });
		return promise;
	}

	private prune(now = Date.now()): void {
		for (const [key, record] of this.records) {
			if (record.createdAt + this.ttlMs <= now) {
				this.records.delete(key);
			}
		}
	}
}
