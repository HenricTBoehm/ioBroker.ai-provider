import { randomUUID } from 'crypto';

import { requestDigest, sha256, valueDigest } from './canonical';
import type { AIRequest, AIResponse, CapabilitiesResponse, ProviderHealthSnapshot, RequestContext } from './contracts';
import { errorResponse, GovernedError } from './errors';
import { ExecutionPool } from './execution-pool';
import type { AccessPolicy } from './policy';
import { ROUTE_POLICY_VERSION, selectRoute } from './policy';
import type { AIProvider } from './providers/provider';
import { DisclosureRegistry } from './registries/disclosure-registry';
import { PromptRegistry } from './registries/prompt-registry';
import { ResponseContractRegistry } from './registries/response-contract-registry';
import { RequestLedger } from './request-ledger';
import { parseAIRequest } from './request-validation';

export interface AuditMetadata {
	requestId: string;
	caller: string;
	userDigest?: string;
	taskType: string;
	privacyClass: string;
	promptTemplate: string;
	responseContract: string;
	disclosureProfile: string;
	requestDigest: string;
	disclosedEvidenceDigest?: string;
	provider?: string;
	model?: string;
	routePolicyVersion: string;
	healthSnapshotTimestamp?: number;
	routingReason?: string;
	startedAt: number;
	finishedAt: number;
	latencyMs: number;
	validationResult: 'PASSED' | 'FAILED' | 'NOT_RUN';
	errorCode?: string;
	inputTokens?: number;
	outputTokens?: number;
}

export interface InferenceServiceOptions {
	providers: AIProvider[];
	accessPolicy: AccessPolicy;
	requestTimeoutMs: number;
	maxConcurrency: number;
	maxQueue: number;
	idempotencyTtlMs: number;
	maxRequestRecords: number;
	audit: (metadata: AuditMetadata) => void;
}

export class InferenceService {
	private readonly prompts = new PromptRegistry();
	private readonly contracts = new ResponseContractRegistry();
	private readonly disclosures = new DisclosureRegistry();
	private readonly ledger: RequestLedger;
	private readonly pool: ExecutionPool;
	private readonly unloadController = new AbortController();

	public constructor(private readonly options: InferenceServiceOptions) {
		this.ledger = new RequestLedger(options.idempotencyTtlMs, options.maxRequestRecords);
		this.pool = new ExecutionPool(options.maxConcurrency, options.maxQueue);
	}

	public generate(rawRequest: unknown, context: RequestContext): Promise<AIResponse> {
		const request = parseAIRequest(rawRequest);
		this.options.accessPolicy.authorize(context, request.taskType);
		const digest = requestDigest(request);
		return this.ledger.run(`${context.callerInstance}\0${request.requestId}`, digest, () =>
			this.pool.run(() => this.execute(request, context, digest)),
		);
	}

	public capabilities(caller: string): CapabilitiesResponse {
		this.options.accessPolicy.authorizeCaller(caller);
		return {
			routePolicyVersion: ROUTE_POLICY_VERSION,
			prompts: this.prompts.list(),
			responseContracts: this.contracts.list(),
			disclosureProfiles: this.disclosures.list(),
			providers: this.options.providers.map(provider => ({
				id: provider.id,
				model: provider.model,
				cloud: provider.cloud,
				capabilities: [...provider.capabilities],
			})),
		};
	}

	public async health(caller: string): Promise<ProviderHealthSnapshot[]> {
		this.options.accessPolicy.authorizeCaller(caller);
		return this.withSignal(signal => Promise.all(this.options.providers.map(provider => provider.health(signal))));
	}

	public async listModels(caller: string): Promise<Record<string, string[]>> {
		this.options.accessPolicy.authorizeCaller(caller);
		return this.withSignal(async signal =>
			Object.fromEntries(
				await Promise.all(
					this.options.providers.map(
						async provider => [provider.id, await provider.listModels(signal)] as const,
					),
				),
			),
		);
	}

	public shutdown(): void {
		this.pool.close();
		this.unloadController.abort(new GovernedError('ADAPTER_UNLOADING', 'Adapter is unloading', true));
	}

	private async execute(request: AIRequest, context: RequestContext, digest: string): Promise<AIResponse> {
		const startedAt = Date.now();
		let audit: AuditMetadata = {
			requestId: request.requestId,
			caller: context.callerInstance,
			userDigest: context.authenticatedUser ? sha256(context.authenticatedUser) : undefined,
			taskType: request.taskType,
			privacyClass: request.privacyClass,
			promptTemplate: `${request.promptTemplateId}@${request.promptTemplateVersion}`,
			responseContract: `${request.responseContractId}@${request.responseContractVersion}`,
			disclosureProfile: 'NOT_RESOLVED',
			requestDigest: digest,
			routePolicyVersion: ROUTE_POLICY_VERSION,
			startedAt,
			finishedAt: startedAt,
			latencyMs: 0,
			validationResult: 'NOT_RUN',
		};

		try {
			const prompt = this.prompts.resolve(
				request.promptTemplateId,
				request.promptTemplateVersion,
				request.taskType,
			);
			const contract = this.contracts.resolve(request.responseContractId, request.responseContractVersion);
			const disclosed = this.disclosures.project(
				prompt.disclosureProfileId,
				prompt.disclosureProfileVersion,
				request.evidence,
			);
			audit = {
				...audit,
				disclosureProfile: `${prompt.disclosureProfileId}@${prompt.disclosureProfileVersion}`,
				disclosedEvidenceDigest: valueDigest('ai-provider-disclosed-evidence:v1', disclosed),
			};
			const result = await this.withSignal(async signal => {
				const health = await Promise.all(this.options.providers.map(provider => provider.health(signal)));
				const route = selectRoute(request, this.options.providers, health);
				audit = {
					...audit,
					provider: route.provider.id,
					model: route.provider.model,
					healthSnapshotTimestamp: route.decision.healthSnapshotTimestamp,
					routingReason: route.decision.reason,
				};
				const generated = await route.provider.generate(
					{
						requestId: request.requestId,
						systemPrompt: prompt.systemPrompt,
						input: disclosed,
						outputSchema: contract.jsonSchema,
						maxOutputTokens: request.limits?.maxOutputTokens ?? 1024,
					},
					signal,
				);
				const output = this.contracts.validate(contract, generated.rawText);
				return { route: route.decision, generated, output };
			}, request.limits?.timeoutMs);

			const finishedAt = Date.now();
			audit = {
				...audit,
				finishedAt,
				latencyMs: finishedAt - startedAt,
				validationResult: 'PASSED',
				inputTokens: result.generated.usage?.inputTokens,
				outputTokens: result.generated.usage?.outputTokens,
			};
			return {
				requestId: request.requestId,
				ok: true,
				output: result.output,
				route: result.route,
				attempts: [{ attemptId: randomUUID(), type: 'generation', validationResult: 'PASSED' }],
				repaired: false,
				usage: result.generated.usage,
				latencyMs: audit.latencyMs,
			};
		} catch (error) {
			const normalized =
				error instanceof DOMException && error.name === 'TimeoutError'
					? new GovernedError('REQUEST_TIMEOUT', 'Inference request timed out', true)
					: error;
			const finishedAt = Date.now();
			const responseError = errorResponse(normalized);
			audit = {
				...audit,
				finishedAt,
				latencyMs: finishedAt - startedAt,
				validationResult: responseError.code === 'SCHEMA_VALIDATION_FAILED' ? 'FAILED' : 'NOT_RUN',
				errorCode: responseError.code,
			};
			return {
				requestId: request.requestId,
				ok: false,
				route: audit.provider
					? {
							policyVersion: ROUTE_POLICY_VERSION,
							healthSnapshotTimestamp: audit.healthSnapshotTimestamp ?? 0,
							provider: audit.provider,
							model: audit.model ?? '',
							reason: audit.routingReason ?? '',
						}
					: undefined,
				attempts:
					audit.validationResult === 'FAILED'
						? [{ attemptId: randomUUID(), type: 'generation', validationResult: 'FAILED' }]
						: undefined,
				latencyMs: audit.latencyMs,
				error: responseError,
			};
		} finally {
			this.options.audit(audit);
		}
	}

	private async withSignal<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs?: number): Promise<T> {
		const timeout = AbortSignal.timeout(timeoutMs ?? this.options.requestTimeoutMs);
		return operation(AbortSignal.any([this.unloadController.signal, timeout]));
	}
}
