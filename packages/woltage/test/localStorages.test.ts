import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {readContext, projectionStorage} from '../src/localStorages.ts';
import mockProjectionContext from './_mock/mockProjectionContext.ts';

await describe('localStorages', async () => {
    await it('readContext throws if called outside context', async () => {
        assert.throws(() => readContext(projectionStorage));

        mockProjectionContext({});
        assert.doesNotThrow(() => readContext(projectionStorage));
    });
});
