import type { ModelRequest, ModelResult, ProviderHealthSnapshot } from '../contracts';
import { GovernedError } from '../errors';
import type { AIProvider } from './provider';

export interface OpenAICompatibleConfig {
	id: string;
	baseUrl: string;
	model: string;
	apiKey?: string;
	cloud: boolean;
	enabled: boolean;
	healthTtlMs: number;
}

export class OpenAICompatibleProvider implements AIProvider {
	public readonly capabilities = ['chat', 'structured-output', 'reasoning'] as const;
	public readonly id: string;
	public readonly model: string;
	public readonly cloud: boolean;
	private cachedHealth?: ProviderHealthSnapshot;

	public constructor(private readonly config: OpenAICompatibleConfig) {
		this.id = config.id;
		this.model = config.model;
		this.cloud = config.cloud;
	}

	private url(path: string): string {
		return `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
	}

	private headers(): Record<string, string> {
		return {
			'content-type': 'application/json',
			...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
		};
	}

	private isConfigured(): boolean {
		return this.config.enabled && this.config.baseUrl.length > 0 && this.config.model.length > 0;
	}

	public async health(signal: AbortSignal): Promise<ProviderHealthSnapshot> {
		const now = Date.now();
		if (this.cachedHealth && this.cachedHealth.validUntil > now) {
			return this.cachedHealth;
		}
		if (!this.isConfigured()) {
			return {
				provider: this.id,
				configured: false,
				available: false,
				checkedAt: now,
				validUntil: now + this.config.healthTtlMs,
			};
		}

		try {
			const response = await fetch(this.url('/models'), { headers: this.headers(), signal });
			this.cachedHealth = {
				provider: this.id,
				configured: true,
				available: response.ok,
				checkedAt: now,
				validUntil: now + this.config.healthTtlMs,
				detail: response.ok ? undefined : `HTTP ${response.status}`,
			};
		} catch (error) {
			if (signal.aborted) {
				throw error;
			}
			this.cachedHealth = {
				provider: this.id,
				configured: true,
				available: false,
				checkedAt: now,
				validUntil: now + this.config.healthTtlMs,
				detail: error instanceof Error ? error.message : 'Health check failed',
			};
		}
		return this.cachedHealth;
	}

	public async listModels(signal: AbortSignal): Promise<string[]> {
		if (!this.isConfigured()) {
			return [];
		}
		const response = await fetch(this.url('/models'), { headers: this.headers(), signal });
		if (!response.ok) {
			throw new GovernedError('PROVIDER_UNAVAILABLE', `${this.id} returned HTTP ${response.status}`, true);
		}
		const body = (await response.json()) as {
			data?: Array<{
				id?: unknown;
			}>;
		};
		return (body.data ?? []).flatMap(item => (typeof item.id === 'string' ? [item.id] : []));
	}

	public async generate(request: ModelRequest, signal: AbortSignal): Promise<ModelResult> {
		if (!this.isConfigured()) {
			throw new GovernedError('PROVIDER_NOT_CONFIGURED', `${this.id} is disabled or incomplete`);
		}
		const response = await fetch(this.url('/chat/completions'), {
			method: 'POST',
			headers: this.headers(),
			signal,
			body: JSON.stringify({
				model: this.model,
				messages: [
					{ role: 'system', content: request.systemPrompt },
					{ role: 'user', content: JSON.stringify(request.input) },
				],
				max_tokens: request.maxOutputTokens,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'governed_response', strict: true, schema: request.outputSchema },
				},
			}),
		});
		if (!response.ok) {
			throw new GovernedError(
				'PROVIDER_REQUEST_FAILED',
				`${this.id} returned HTTP ${response.status}`,
				response.status >= 500,
			);
		}
		const body = (await response.json()) as {
			choices?: Array<{
				message?: {
					content?: unknown;
				};
			}>;
			usage?: {
				prompt_tokens?: number;
				completion_tokens?: number;
			};
		};
		const content = body.choices?.[0]?.message?.content;
		if (typeof content !== 'string') {
			throw new GovernedError('INVALID_PROVIDER_RESPONSE', `${this.id} returned no text content`);
		}
		return {
			provider: this.id,
			model: this.model,
			rawText: content,
			usage: { inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens },
		};
	}
}
