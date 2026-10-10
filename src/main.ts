import * as utils from '@iobroker/adapter-core';

import { TASK_TYPES, type RequestContext, type TaskType } from './contracts';
import { errorResponse } from './errors';
import { InferenceService, type AuditMetadata } from './inference-service';
import { AccessPolicy } from './policy';
import { OpenAICompatibleProvider } from './providers/openai-compatible';

function csv(value = ''): string[] {
	return value
		.split(',')
		.map(item => item.trim())
		.filter(Boolean);
}

function taskTypes(value: string): TaskType[] {
	return csv(value).flatMap(value => (TASK_TYPES.includes(value as TaskType) ? [value as TaskType] : []));
}

class AiProvider extends utils.Adapter {
	private service?: InferenceService;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: 'ai-provider' });
		this.on('ready', this.onReady.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private onReady(): void {
		const healthTtlMs = Math.max(1_000, this.config.healthTtlMs || 30_000);
		const providers = [
			new OpenAICompatibleProvider({
				id: 'local',
				cloud: false,
				enabled: this.config.localEnabled,
				baseUrl: this.config.localBaseUrl,
				model: this.config.localModel,
				apiKey: this.config.localApiKey,
				healthTtlMs,
			}),
			new OpenAICompatibleProvider({
				id: 'openai',
				cloud: true,
				enabled: this.config.openAiEnabled,
				baseUrl: this.config.openAiBaseUrl,
				model: this.config.openAiModel,
				apiKey: this.config.openAiApiKey,
				healthTtlMs,
			}),
		];
		this.service = new InferenceService({
			providers,
			accessPolicy: new AccessPolicy(
				csv(this.config.allowedCallers),
				taskTypes(this.config.requireUserForTaskTypes),
			),
			requestTimeoutMs: Math.max(1_000, this.config.requestTimeoutMs || 30_000),
			maxConcurrency: Math.max(1, this.config.maxConcurrency || 2),
			maxQueue: Math.max(0, this.config.maxQueue ?? 8),
			idempotencyTtlMs: Math.max(1_000, this.config.idempotencyTtlMs || 300_000),
			maxRequestRecords: Math.max(1, this.config.maxRequestRecords || 1_000),
			audit: metadata => this.audit(metadata),
		});
		this.log.info('Governed AI inference provider is ready; no state, object, or effect access is enabled');
	}

	private async onMessage(message: ioBroker.Message): Promise<void> {
		if (!message.callback) {
			return;
		}
		const envelope = message as ioBroker.Message & { user?: unknown };
		const context: RequestContext = {
			callerInstance: message.from,
			authenticatedUser: typeof envelope.user === 'string' ? envelope.user : undefined,
		};
		try {
			if (!this.service) {
				throw new Error('Adapter is not ready');
			}
			let result: unknown;
			switch (message.command) {
				case 'generate':
					result = await this.service.generate(message.message, context);
					break;
				case 'health':
					result = await this.service.health(context.callerInstance);
					break;
				case 'capabilities':
					result = this.service.capabilities(context.callerInstance);
					break;
				case 'listModels':
					result = await this.service.listModels(context.callerInstance);
					break;
				default:
					result = {
						ok: false,
						error: {
							code: 'UNKNOWN_COMMAND',
							message: `Unknown command ${message.command}`,
							retryable: false,
						},
					};
			}
			this.sendTo(message.from, message.command, result, message.callback);
		} catch (error) {
			this.sendTo(message.from, message.command, { ok: false, error: errorResponse(error) }, message.callback);
		}
	}

	private audit(metadata: AuditMetadata): void {
		this.log.info(`audit ${JSON.stringify(metadata)}`);
	}

	private onUnload(callback: () => void): void {
		try {
			this.service?.shutdown();
		} finally {
			callback();
		}
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AiProvider(options);
} else {
	new AiProvider();
}
