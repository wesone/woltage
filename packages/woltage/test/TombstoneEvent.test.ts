import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import TombstoneEvent from '../src/TombstoneEvent.ts';

await describe('TombstoneEvent', async () => {
    await it('can be constructed without any parameters', async () => {
        assert.doesNotThrow(() => new TombstoneEvent());
    });

    await it('allows every payload by default', async () => {
        assert.doesNotThrow(() => new TombstoneEvent({payload: {aggregateType: 'test'}}));
    });
});
