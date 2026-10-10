import { GovernedError } from '../errors';

interface DisclosureProfile {
	id: string;
	version: string;
	paths: string[];
}

const PROFILES: DisclosureProfile[] = [
	{
		id: 'smarthome.climate-diagnosis',
		version: '1',
		paths: [
			'room.name',
			'climate.temperature',
			'climate.humidity',
			'outside.temperature',
			'window.open',
			'evidenceTimestamp',
		],
	},
	{
		id: 'smarthome.interpretation',
		version: '1',
		paths: [
			'subject.type',
			'subject.name',
			'facts.value',
			'facts.unit',
			'facts.timestamp',
			'finding.classification',
			'finding.summary',
			'evidenceTimestamp',
		],
	},
];

const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function key(id: string, version: string): string {
	return `${id}@${version}`;
}

function readPath(source: unknown, segments: string[]): { found: boolean; value?: unknown } {
	let current = source;
	for (const segment of segments) {
		if (!current || typeof current !== 'object' || Array.isArray(current)) {
			return { found: false };
		}
		const record = current as Record<string, unknown>;
		if (!Object.prototype.hasOwnProperty.call(record, segment)) {
			return { found: false };
		}
		current = record[segment];
	}
	return { found: true, value: current };
}

function writePath(target: Record<string, unknown>, segments: string[], value: unknown): void {
	let current = target;
	for (let index = 0; index < segments.length - 1; index++) {
		const segment = segments[index];
		const existing = current[segment];
		if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
			current[segment] = {};
		}
		current = current[segment] as Record<string, unknown>;
	}
	current[segments.at(-1)!] = structuredClone(value);
}

export class DisclosureRegistry {
	private readonly profiles = new Map(PROFILES.map(profile => [key(profile.id, profile.version), profile]));

	public project(id: string, version: string, evidence: unknown): unknown {
		const profile = this.profiles.get(key(id, version));
		if (!profile) {
			throw new GovernedError('UNKNOWN_DISCLOSURE_PROFILE', `Unknown disclosure profile ${id}@${version}`);
		}

		const result: Record<string, unknown> = {};
		for (const path of profile.paths) {
			const segments = path.split('.');
			if (segments.some(segment => UNSAFE_SEGMENTS.has(segment))) {
				throw new GovernedError('INVALID_DISCLOSURE_PROFILE', `Unsafe disclosure path: ${path}`);
			}
			const selected = readPath(evidence, segments);
			if (selected.found) {
				writePath(result, segments, selected.value);
			}
		}
		return result;
	}

	public list(): Array<{
		id: string;
		version: string;
	}> {
		return [...this.profiles.values()].map(({ id, version }) => ({ id, version }));
	}
}
