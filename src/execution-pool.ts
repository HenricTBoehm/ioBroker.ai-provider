import { GovernedError } from './errors';

interface WaitingTask {
	resolve: () => void;
	reject: (error: Error) => void;
}

export class ExecutionPool {
	private active = 0;
	private readonly queue: WaitingTask[] = [];
	private closed = false;

	public constructor(
		private readonly concurrency: number,
		private readonly maxQueue: number,
	) {}

	public async run<T>(operation: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await operation();
		} finally {
			this.release();
		}
	}

	public close(): void {
		this.closed = true;
		for (const task of this.queue.splice(0)) {
			task.reject(new GovernedError('ADAPTER_UNLOADING', 'Adapter is unloading', true));
		}
	}

	private acquire(): Promise<void> {
		if (this.closed) {
			return Promise.reject(new GovernedError('ADAPTER_UNLOADING', 'Adapter is unloading', true));
		}
		if (this.active < this.concurrency) {
			this.active++;
			return Promise.resolve();
		}
		if (this.queue.length >= this.maxQueue) {
			return Promise.reject(new GovernedError('QUEUE_FULL', 'Inference queue is full', true));
		}
		return new Promise((resolve, reject) =>
			this.queue.push({
				resolve: () => {
					this.active++;
					resolve();
				},
				reject,
			}),
		);
	}

	private release(): void {
		this.active--;
		this.queue.shift()?.resolve();
	}
}
