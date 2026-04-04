import {afterEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';

import emit from '../../src/sideEffects/emit.ts';
import mockProjectionContext from '../_mock/mockProjectionContext.ts';
import mockEventClass from '../_mock/mockEventClass.ts';

await describe('emit', async () => {
    const {eventStore} = mockProjectionContext({isReplaying: false});
    const TestEvent = mockEventClass('test', 1);

    afterEach(() => {
        eventStore.mockReset();
    });

    await it('can append an event', async () => {
        const aggregateType = 'aggregateType1';
        const aggregateId = 'aggregateId1';

        await emit(aggregateType, new TestEvent({aggregateId, payload: {}}));

        assert.strictEqual(eventStore.append.mock.callCount(), 1);
        assert.partialDeepStrictEqual(
            eventStore.append.mock.calls[0].arguments,
            [
                aggregateType,
                aggregateId,
                [{aggregateId, payload: {}}]
            ]
        );
    });

    await it('can append multiple events', async () => {
        const aggregateType = 'aggregateType1';
        const aggregateId = 'aggregateId1';

        await emit(aggregateType, [
            new TestEvent({aggregateId, payload: {}}),
            new TestEvent({aggregateId, payload: {}})
        ]);

        assert.strictEqual(eventStore.append.mock.callCount(), 1);
        assert.partialDeepStrictEqual(
            eventStore.append.mock.calls[0].arguments,
            [
                aggregateType,
                aggregateId,
                [
                    {aggregateId, payload: {}},
                    {aggregateId, payload: {}}
                ]
            ]
        );
    });

    await it('can append events to different aggregate streams', async () => {
        const aggregateType = 'aggregateType1';
        const aggregateId1 = 'aggregateId1';
        const aggregateId2 = 'aggregateId2';

        await emit(aggregateType, [
            new TestEvent({aggregateId: aggregateId1, payload: {}}),
            new TestEvent({aggregateId: aggregateId1, payload: {}}),
            new TestEvent({aggregateId: aggregateId2, payload: {}})
        ]);

        assert.strictEqual(eventStore.append.mock.callCount(), 2);
        assert.partialDeepStrictEqual(
            eventStore.append.mock.calls[0].arguments,
            [
                aggregateType,
                aggregateId1,
                [
                    {aggregateId: aggregateId1, payload: {}},
                    {aggregateId: aggregateId1, payload: {}}
                ]
            ]
        );
        assert.partialDeepStrictEqual(
            eventStore.append.mock.calls[1].arguments,
            [
                aggregateType,
                aggregateId2,
                [{aggregateId: aggregateId2, payload: {}}]
            ]
        );
    });

    await it('will not call append if there are no events to append', async () => {
        await emit('aggregateType1', []);
        assert.strictEqual(eventStore.append.mock.callCount(), 0);
    });
});
