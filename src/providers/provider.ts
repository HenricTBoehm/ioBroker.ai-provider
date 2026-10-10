import type { Capability, ModelRequest, ModelResult, ProviderHealthSnapshot } from '../contracts';

export interface AIProvider {
	readonly id: string;
	readonly model: string;
	readonly cloud: boolean;
	readonly capabilities: readonly Capability[];
	health(signal: AbortSignal): Promise<ProviderHealthSnapshot>;
	generate(request: ModelRequest, signal: AbortSignal): Promise<ModelResult>;
	listModels(signal: AbortSignal): Promise<string[]>;
}
