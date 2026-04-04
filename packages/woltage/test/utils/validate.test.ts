import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import z from 'zod';
import validate from '../../src/utils/validate.ts';
import BadRequestError from '../../src/errors/BadRequestError.ts';

await describe('validate', async () => {
    const schema = z.object({
        num: z.number()
    });

    await it('validates data against a Zod schema', async () => {
        assert.deepStrictEqual(await validate(schema, {num: 42, str: '42'}), {num: 42});
    });

    await it('validates data against a Standard Schema compliant schema', async () => {
        const schema = {
            ['~standard']: {
                version: 1 as const,
                vendor: 'Woltage',
                validate: (value: unknown) => Promise.resolve({value})
            }
        };
        assert.deepStrictEqual(await validate(schema, 42), 42);
    });

    await it('throws BadRequestError if validation fails', async () => {
        assert.rejects(() => validate(schema, {str: '42'}), BadRequestError);
    });

    await it('does not swallow unexpected errors that do not relate to Zod parsing', async () => {
        schema.parse = () => {throw new Error('Test');};
        assert.rejects(() => validate(schema, {str: '42'}));
    });
});
