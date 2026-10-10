import Ajv, { type ValidateFunction } from 'ajv';

import { GovernedError } from '../errors';

export interface ResponseContract {
	id: string;
	version: string;
	jsonSchema: Record<string, unknown>;
	validate: ValidateFunction;
}

const SCHEMAS: Array<{ id: string; version: string; jsonSchema: Record<string, unknown> }> = [
	{
		id: 'smarthome.assessment-result',
		version: '1',
		jsonSchema: {
			type: 'object',
			additionalProperties: false,
			required: ['classification', 'summary', 'recommendations', 'confidence'],
			properties: {
				classification: {
					type: 'string',
					enum: ['NORMAL', 'WATCH', 'ACTION_RECOMMENDED', 'UNCLEAR'],
				},
				summary: { type: 'string', minLength: 1, maxLength: 2000 },
				recommendations: {
					type: 'array',
					maxItems: 10,
					items: { type: 'string', minLength: 1, maxLength: 500 },
				},
				confidence: { type: 'number', minimum: 0, maximum: 1 },
			},
		},
	},
];

function key(id: string, version: string): string {
	return `${id}@${version}`;
}

export class ResponseContractRegistry {
	private readonly contracts: Map<string, ResponseContract>;

	public constructor() {
		const ajv = new Ajv({ allErrors: true, strict: true });
		this.contracts = new Map(
			SCHEMAS.map(definition => [
				key(definition.id, definition.version),
				{ ...definition, validate: ajv.compile(definition.jsonSchema) },
			]),
		);
	}

	public resolve(id: string, version: string): ResponseContract {
		const contract = this.contracts.get(key(id, version));
		if (!contract) {
			throw new GovernedError('UNKNOWN_RESPONSE_CONTRACT', `Unknown response contract ${id}@${version}`);
		}
		return contract;
	}

	public validate(contract: ResponseContract, rawText: string): unknown {
		let parsed: unknown;
		try {
			parsed = JSON.parse(rawText);
		} catch {
			throw new GovernedError('SCHEMA_VALIDATION_FAILED', 'Model output is not valid JSON');
		}

		if (!contract.validate(parsed)) {
			const detail = contract.validate.errors
				?.map(error => `${error.instancePath || '/'} ${error.message}`)
				.join('; ');
			throw new GovernedError(
				'SCHEMA_VALIDATION_FAILED',
				`Model output violates the response contract: ${detail}`,
			);
		}

		return parsed;
	}

	public list(): Array<{
		id: string;
		version: string;
	}> {
		return [...this.contracts.values()].map(({ id, version }) => ({ id, version }));
	}
}
