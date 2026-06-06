import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import sideEffect from '../../src/sideEffects/sideEffect.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import mockProjectionContext from '../_mock/mockProjectionContext.ts';
import type Projection from '../../src/read/Projection.ts';
import mockConsole from '../_mock/mockConsole.ts';

await describe('sideEffect', async () => {
    const TestEvent = mockEventClass('test');
    const currentEvent = new TestEvent({
        aggregateId: 'test',
        payload: {}
    });

    await it('prevents execution if there is no event context', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);
        const {consoleCalls, resetConsoleMock} = mockConsole('trace');
        await testSideEffect(null);
        resetConsoleMock();
        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
        assert.strictEqual(consoleCalls.length, 1, 'Did not warn the user (`console.trace`).');
    });

    await it('prevents execution if system is replaying', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);

        mockProjectionContext({isReplaying: true, currentEvent});
        await testSideEffect(null);

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
        await testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 0);
    });

    await it('executes side effect for new events', async () => {
        const actualSideEffect = mock.fn();
        const testSideEffect = sideEffect(actualSideEffect);

        mockProjectionContext({isReplaying: false, currentEvent});
        await testSideEffect(null);

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
        await testSideEffect(null);

        assert.strictEqual(actualSideEffect.mock.callCount(), 1);
    });
});
