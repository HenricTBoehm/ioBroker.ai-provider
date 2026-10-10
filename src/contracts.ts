export const TASK_TYPES = [
	'SIMPLE_INTERPRETATION',
	'COMPLEX_INTERPRETATION',
	'DIAGNOSIS',
	'PLANNING',
	'SUMMARIZATION',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const PRIVACY_CLASSES = ['LOCAL_ONLY', 'CLOUD_REDACTED', 'CLOUD_ALLOWED'] as const;
export type PrivacyClass = (typeof PRIVACY_CLASSES)[number];

export const LATENCY_CLASSES = ['INTERACTIVE', 'NORMAL', 'BACKGROUND'] as const;
export type LatencyClass = (typeof LATENCY_CLASSES)[number];

export type Capability = 'chat' | 'structured-output' | 'reasoning';

export interface AIRequest {
	requestId: string;
	taskType: TaskType;
	privacyClass: PrivacyClass;
	latencyClass: LatencyClass;
	promptTemplateId: string;
	promptTemplateVersion: string;
	responseContractId: string;
	responseContractVersion: string;
	evidence: unknown;
	requiredCapabilities?: Capability[];
	limits?: {
		timeoutMs?: number;
		maxOutputTokens?: number;
	};
}

export interface RequestContext {
	callerInstance: string;
	authenticatedUser?: string;
}

export interface ModelRequest {
	requestId: string;
	systemPrompt: string;
	input: unknown;
	outputSchema: Record<string, unknown>;
	maxOutputTokens: number;
}

export interface ModelResult {
	provider: string;
	model: string;
	rawText: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

export interface ProviderHealthSnapshot {
	provider: string;
	configured: boolean;
	available: boolean;
	checkedAt: number;
	validUntil: number;
	detail?: string;
}

export interface RouteDecision {
	policyVersion: string;
	healthSnapshotTimestamp: number;
	provider: string;
	model: string;
	reason: string;
}

export interface AttemptMetadata {
	attemptId: string;
	type: 'generation' | 'repair';
	validationResult: 'PASSED' | 'FAILED' | 'NOT_RUN';
}

export interface AIResponse {
	requestId: string;
	ok: boolean;
	output?: unknown;
	route?: RouteDecision;
	attempts?: AttemptMetadata[];
	repaired?: boolean;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
	latencyMs?: number;
	error?: {
		code: string;
		message: string;
		retryable: boolean;
	};
}

export interface CapabilitiesResponse {
	routePolicyVersion: string;
	prompts: Array<{
		id: string;
		version: string;
	}>;
	responseContracts: Array<{
		id: string;
		version: string;
	}>;
	disclosureProfiles: Array<{
		id: string;
		version: string;
	}>;
	providers: Array<{
		id: string;
		model: string;
		cloud: boolean;
		capabilities: readonly Capability[];
	}>;
}
