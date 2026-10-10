export class GovernedError extends Error {
	public constructor(
		public readonly code: string,
		message: string,
		public readonly retryable = false,
	) {
		super(message);
		this.name = 'GovernedError';
	}
}

export function errorResponse(error: unknown): {
	code: string;
	message: string;
	retryable: boolean;
} {
	if (error instanceof GovernedError) {
		return {
			code: error.code,
			message: error.message,
			retryable: error.retryable,
		};
	}

	return {
		code: 'INTERNAL_ERROR',
		message: error instanceof Error ? error.message : 'Unknown internal error',
		retryable: false,
	};
}
