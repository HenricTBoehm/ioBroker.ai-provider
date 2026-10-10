import type { TaskType } from '../contracts';
import { GovernedError } from '../errors';

export interface PromptDefinition {
	id: string;
	version: string;
	allowedTaskTypes: TaskType[];
	systemPrompt: string;
	disclosureProfileId: string;
	disclosureProfileVersion: string;
}

const DEFINITIONS: PromptDefinition[] = [
	{
		id: 'smarthome.climate-diagnosis',
		version: '1',
		allowedTaskTypes: ['DIAGNOSIS'],
		disclosureProfileId: 'smarthome.climate-diagnosis',
		disclosureProfileVersion: '1',
		systemPrompt: [
			'Assess only the supplied climate evidence.',
			'Distinguish confirmed findings from uncertainty.',
			'Do not claim that any action was executed.',
			'Do not invent missing measurements.',
			'Return exactly one JSON object matching the supplied response schema.',
		].join(' '),
	},
	{
		id: 'smarthome.interpretation',
		version: '1',
		allowedTaskTypes: ['SIMPLE_INTERPRETATION', 'COMPLEX_INTERPRETATION'],
		disclosureProfileId: 'smarthome.interpretation',
		disclosureProfileVersion: '1',
		systemPrompt: [
			'Interpret only the supplied smart-home evidence.',
			'Do not claim that any action was executed.',
			'Do not invent missing evidence.',
			'Return exactly one JSON object matching the supplied response schema.',
		].join(' '),
	},
];

function key(id: string, version: string): string {
	return `${id}@${version}`;
}

export class PromptRegistry {
	private readonly definitions = new Map(
		DEFINITIONS.map(definition => [key(definition.id, definition.version), definition]),
	);

	public resolve(id: string, version: string, taskType: TaskType): PromptDefinition {
		const definition = this.definitions.get(key(id, version));
		if (!definition) {
			throw new GovernedError('UNKNOWN_PROMPT_TEMPLATE', `Unknown prompt template ${id}@${version}`);
		}
		if (!definition.allowedTaskTypes.includes(taskType)) {
			throw new GovernedError(
				'PROMPT_TASK_MISMATCH',
				`Prompt ${id}@${version} does not allow task type ${taskType}`,
			);
		}
		return definition;
	}

	public list(): Array<{
		id: string;
		version: string;
	}> {
		return [...this.definitions.values()].map(({ id, version }) => ({ id, version }));
	}
}
