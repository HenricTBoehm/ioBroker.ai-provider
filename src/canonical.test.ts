import { strict as assert } from 'node:assert';

import { canonicalize } from './canonical';
import { GovernedError } from './errors';

function numberFromIeee754(hex: string): number {
	return Buffer.from(hex, 'hex').readDoubleBE(0);
}

describe('RFC 8785 JSON canonicalization', () => {
	it('matches the serialization and property-ordering example from sections 3.2.2 and 3.2.3', () => {
		const input = {
			numbers: [333333333.33333329, 1e30, 4.5, 0.002, 1e-27],
			string: "€$\u000f\nA'B\"\\\\\"/",
			literals: [null, true, false],
		};

		assert.equal(
			canonicalize(input),
			String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`,
		);
	});

	it('sorts property names by their UTF-16 code units as specified in section 3.2.3', () => {
		const input = {
			'€': 'Euro Sign',
			'\r': 'Carriage Return',
			'דּ': 'Hebrew Letter Dalet With Dagesh',
			'1': 'One',
			'😀': 'Emoji: Grinning Face',
			'': 'Control',
			'ö': 'Latin Small Letter O With Diaeresis',
		};

		assert.equal(
			canonicalize(input),
			String.raw`{"\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`,
		);
	});

	it('matches the ECMAScript number serialization samples from Appendix B', () => {
		const vectors: Array<[string, string]> = [
			['0000000000000000', '0'],
			['8000000000000000', '0'],
			['0000000000000001', '5e-324'],
			['8000000000000001', '-5e-324'],
			['7fefffffffffffff', '1.7976931348623157e+308'],
			['ffefffffffffffff', '-1.7976931348623157e+308'],
			['4340000000000000', '9007199254740992'],
			['c340000000000000', '-9007199254740992'],
			['4430000000000000', '295147905179352830000'],
			['44b52d02c7e14af5', '9.999999999999997e+22'],
			['44b52d02c7e14af6', '1e+23'],
			['44b52d02c7e14af7', '1.0000000000000001e+23'],
			['444b1ae4d6e2ef4e', '999999999999999700000'],
			['444b1ae4d6e2ef4f', '999999999999999900000'],
			['444b1ae4d6e2ef50', '1e+21'],
			['3eb0c6f7a0b5ed8c', '9.999999999999997e-7'],
			['3eb0c6f7a0b5ed8d', '0.000001'],
			['41b3de4355555553', '333333333.3333332'],
			['41b3de4355555554', '333333333.33333325'],
			['41b3de4355555555', '333333333.3333333'],
			['41b3de4355555556', '333333333.3333334'],
			['41b3de4355555557', '333333333.33333343'],
			['becbf647612f3696', '-0.0000033333333333333333'],
			['43143ff3c1cb0959', '1424953923781206.2'],
		];

		for (const [ieee754, expected] of vectors) {
			assert.equal(canonicalize(numberFromIeee754(ieee754)), expected, ieee754);
		}
	});

	it('rejects the non-finite number values excluded by section 3.2.2.3', () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			assert.throws(
				() => canonicalize(value),
				(error: unknown) => error instanceof GovernedError && error.code === 'INVALID_JSON_VALUE',
			);
		}
	});

	it('rejects lone UTF-16 surrogates in values and property names', () => {
		for (const value of ['\udead', '\ud800', { ['\udead']: 'invalid' }]) {
			assert.throws(
				() => canonicalize(value),
				(error: unknown) => error instanceof GovernedError && error.code === 'INVALID_JSON_VALUE',
			);
		}
	});
});
