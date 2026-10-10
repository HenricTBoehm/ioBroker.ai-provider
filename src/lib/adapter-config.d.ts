// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			allowedCallers: string;
			requireUserForTaskTypes: string;
			localEnabled: boolean;
			localBaseUrl: string;
			localModel: string;
			localApiKey: string;
			openAiEnabled: boolean;
			openAiBaseUrl: string;
			openAiModel: string;
			openAiApiKey: string;
			healthTtlMs: number;
			requestTimeoutMs: number;
			maxConcurrency: number;
			maxQueue: number;
			idempotencyTtlMs: number;
			maxRequestRecords: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
