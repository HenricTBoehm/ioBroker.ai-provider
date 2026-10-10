import type {
	AIRequest,
	Capability,
	ProviderHealthSnapshot,
	RequestContext,
	RouteDecision,
	TaskType,
} from './contracts';
import { GovernedError } from './errors';
import type { AIProvider } from './providers/provider';

export const ROUTE_POLICY_VERSION = '1';

export class AccessPolicy {
	private readonly callers: Set<string>;
	private readonly userRequired: Set<TaskType>;

	public constructor(allowedCallers: string[], requireUserForTaskTypes: TaskType[]) {
		this.callers = new Set(allowedCallers);
		this.userRequired = new Set(requireUserForTaskTypes);
	}

	public authorize(context: RequestContext, taskType: TaskType): void {
		this.authorizeCaller(context.callerInstance);
		if (this.userRequired.has(taskType) && !context.authenticatedUser) {
			throw new GovernedError('USER_CONTEXT_REQUIRED', `Task type ${taskType} requires an authenticated user`);
		}
	}

	public authorizeCaller(callerInstance: string): void {
		if (!callerInstance.startsWith('system.adapter.') || !this.callers.has(callerInstance)) {
			throw new GovernedError('CALLER_NOT_ALLOWED', `Caller ${callerInstance} is not allowed`);
		}
	}
}

export function selectRoute(
	request: AIRequest,
	providers: AIProvider[],
	health: ProviderHealthSnapshot[],
	now = Date.now(),
): {
	provider: AIProvider;
	decision: RouteDecision;
} {
	const required = new Set<Capability>(request.requiredCapabilities ?? ['chat', 'structured-output']);
	const healthy = providers.filter(provider => {
		const snapshot = health.find(item => item.provider === provider.id);
		return (
			snapshot?.configured &&
			snapshot.available &&
			snapshot.checkedAt <= now &&
			snapshot.validUntil > now &&
			[...required].every(capability => provider.capabilities.includes(capability))
		);
	});
	const complex = ['COMPLEX_INTERPRETATION', 'DIAGNOSIS', 'PLANNING'].includes(request.taskType);
	const targetCloud = request.privacyClass !== 'LOCAL_ONLY' && complex;
	const provider = healthy.find(candidate => candidate.cloud === targetCloud);
	if (!provider) {
		throw new GovernedError(
			'NO_ROUTABLE_PROVIDER',
			`No fresh, healthy ${targetCloud ? 'cloud' : 'local'} provider satisfies policy`,
			true,
		);
	}
	const newestHealth = Math.max(...health.map(item => item.checkedAt));
	return {
		provider,
		decision: {
			policyVersion: ROUTE_POLICY_VERSION,
			healthSnapshotTimestamp: newestHealth,
			provider: provider.id,
			model: provider.model,
			reason: targetCloud
				? 'complex task with cloud-permitted privacy class'
				: 'local route required by privacy or task policy',
		},
	};
}
