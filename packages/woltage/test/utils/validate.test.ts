import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import z from 'zod';
import validate from '../../src/utils/validate.ts';
import BadRequestError from '../../src/errors/BadRequestError.ts';

describe('validate', async () => {
    const schema = z.object({
        num: z.number(),
    });

    await it('validates data against a Zod schema', async () => {
        assert.deepStrictEqual(validate(schema, {num: 42, str: '42'}), {num: 42});
    });

    await it('throws BadRequestError if validation fails', async () => {
        assert.throws(() => validate(schema, {str: '42'}), BadRequestError);
    });

    await it('does not swallow unexpected errors that do not relate to Zod parsing', async () => {
        schema.parse = () => {throw new Error('Test');};
        assert.throws(() => validate(schema, {str: '42'}));
    });
});
