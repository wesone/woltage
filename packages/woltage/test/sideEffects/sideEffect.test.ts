import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import sideEffect from '../../src/sideEffects/sideEffect.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import mockProjectionContext from '../_mock/mockProjectionContext.ts';
import type Projection from '../../src/read/Projection.ts';

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

        mockProjectionContext({isReplaying: true, currentEvent});
        testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('prevents execution if projection is not active', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);

        mockProjectionContext({
            isReplaying: false,
            currentEvent,
            projection: {isActive: false} as unknown as Projection
        });
        testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('executes side effect for new events', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);

        mockProjectionContext({isReplaying: false, currentEvent});
        testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 1);
    });

    await it('executes side effect for new events of an active projection', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);

        mockProjectionContext({
            isReplaying: false,
            currentEvent,
            projection: {isActive: true} as unknown as Projection
        });
        testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 1);
    });
});
