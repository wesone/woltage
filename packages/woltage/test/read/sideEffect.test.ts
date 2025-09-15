import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import sideEffect from '../../src/read/sideEffect.ts';
import {projectionStorage} from '../../src/localStorages.ts';
import mockEventClass from '../_mock/mockEventClass.ts';

describe('sideEffect', async () => {
    const TestEvent = mockEventClass('test');
    const currentEvent = new TestEvent({
        aggregateId: 'test',
        payload: {}
    });

    await it('prevents execution if there is no event context', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        testSideEffect(null);
        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('prevents execution if system is replaying', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        projectionStorage.run({isReplaying: true, currentEvent}, () => testSideEffect(null));
        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('executes side effect for new events', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        projectionStorage.run({isReplaying: false, currentEvent}, () => testSideEffect(null));
        assert.strictEqual(actualSideEffect.mock.callCount(), 1);
    });
});
