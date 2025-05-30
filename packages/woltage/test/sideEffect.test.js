import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import sideEffect from '../src/read/sideEffect.ts';
import {projectionStorage} from '../src/localStorages.ts';

describe('sideEffect', async () => {
    await it('prevents execution if there is no event context', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        testSideEffect();
        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('prevents execution if system is replaying', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        projectionStorage.run({isReplaying: true}, () => testSideEffect());
        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('executes side effect for new events', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        projectionStorage.run({isReplaying: false}, () => testSideEffect());
        assert.strictEqual(actualSideEffect.mock.callCount(), 1);
    });
});
