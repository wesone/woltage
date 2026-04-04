import {describe, it, mock, afterEach} from 'node:test';
import assert from 'node:assert/strict';

import Projection from '../../src/read/Projection.ts';
import Projector from '../../src/read/Projector.ts';
import type Event from '../../src/Event.ts';
import type {IEventStore} from '../../src/adapters/EventStore.ts';
import StoreMock from '../_mock/StoreMock.ts';
import mockEventClass from '../_mock/mockEventClass.ts';

await describe('Projection', async () => {
    const TestEvent = mockEventClass('test.event', 1);
    const eventHandler = mock.fn();
    class TestProjector extends Projector {
        static schema = {};
        static version = 1;

        [TestEvent.identity](event: Event) {
            eventHandler(event);
        }
    }

    afterEach(() => {
        eventHandler.mock.resetCalls();
    });

    await it('computes id and display name statically', async () => {
        assert.strictEqual(Projection.getId('proj', 1), 'proj-1');
        assert.strictEqual(Projection.getDisplayName('proj', 1), 'proj@1');
    });

    await describe('init', async () => {
        await it('detects replayed state if no events exist and will not emit `replayed`', async () => {
            const eventStore = {
                getLatestPosition: mock.fn(async () => null),
                subscribe: mock.fn(() => ({
                    on: mock.fn(),
                    pause: mock.fn(),
                    resume: mock.fn(),
                    destroy: mock.fn()
                }))
            } as unknown as IEventStore;
            const store = new StoreMock();

            const projection = new Projection(
                {config: {}} as any,
                eventStore,
                'proj',
                1,
                TestProjector,
                store
            );

            const replayedHandler = mock.fn();
            projection.on('replayed', replayedHandler);

            await projection.init();

            assert.strictEqual(projection.isReplaying, false);
            assert.strictEqual(projection.isLiveTracking, true);
            assert.strictEqual(replayedHandler.mock.callCount(), 0);
        });

        await it('emits `replayed` once when first live event catches up from an initial position', async () => {
            let onEvent: ((event: Event) => Promise<void>) | undefined;
            const subscription = {
                on: mock.fn((event: string, callback: Function) => {
                    if(event === 'data')
                        onEvent = callback as (event: Event) => Promise<void>;
                }),
                pause: mock.fn(),
                resume: mock.fn(),
                destroy: mock.fn()
            };
            const eventStore = {
                getLatestPosition: mock.fn(async () => 1n),
                subscribe: mock.fn(() => subscription)
            } as unknown as IEventStore;
            const store = new StoreMock();

            const projection = new Projection(
                {config: {}} as any,
                eventStore,
                'proj',
                1,
                TestProjector,
                store
            );

            const replayedHandler = mock.fn();
            projection.on('replayed', replayedHandler);

            await projection.init();

            assert.strictEqual(projection.isReplaying, true);
            assert.strictEqual(projection.isLiveTracking, false);
            assert.ok(onEvent, 'Projection did not subscribe to events');

            await onEvent(new TestEvent({aggregateId: 'aggregateId', payload: {}, position: 1n}));

            assert.strictEqual(replayedHandler.mock.callCount(), 1);
            assert.strictEqual(eventHandler.mock.callCount(), 1);
            assert.strictEqual(projection.isReplaying, false);
            assert.strictEqual(projection.isLiveTracking, true);
        });

        await it('detects replayed state with an existing projection position and replays immediately', async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const subscribe = mock.fn((subscribeOptions: any) => ({
                on: mock.fn(),
                pause: mock.fn(),
                resume: mock.fn(),
                destroy: mock.fn()
            }));
            const eventStore = {
                getLatestPosition: mock.fn(async () => 1n),
                subscribe
            } as unknown as IEventStore;
            const store = new StoreMock();

            const projection = new Projection(
                {config: {}} as any,
                eventStore,
                'proj',
                1,
                TestProjector,
                store
            );

            await store.tables._woltage.set({projectionId: projection.id, position: 1n});

            await projection.init();

            assert.strictEqual(projection.isReplaying, false);
            assert.strictEqual(projection.isLiveTracking, true);
            assert.deepStrictEqual(subscribe.mock.calls[0].arguments[0], {
                fromPosition: 1n,
                filter: {types: [TestEvent.type]}
            });
        });
    });

    await it('processes an event and persists its handled position', async () => {
        const eventStore = {
            getLatestPosition: mock.fn(async () => 1n),
            subscribe: mock.fn(() => ({
                on: mock.fn(),
                pause: mock.fn(),
                resume: mock.fn(),
                destroy: mock.fn()
            }))
        } as unknown as IEventStore;
        const store = new StoreMock();

        const projection = new Projection(
            {config: {}} as any,
            eventStore,
            'proj',
            1,
            TestProjector,
            store
        );

        const event = new TestEvent({aggregateId: 'aggregateId', payload: {}, position: 2n});
        await projection.onEvent(event);

        assert.strictEqual(eventHandler.mock.callCount(), 1);
        assert.strictEqual(store.tables._woltage.set.mock.callCount(), 1);
        assert.deepStrictEqual(store.tables._woltage.set.mock.calls[0].arguments[0], {
            projectionId: projection.id,
            position: 2n
        });
    });

    await it('stops by destroying subscription and closing the store', async () => {
        const subscription = {
            on: mock.fn(),
            pause: mock.fn(),
            resume: mock.fn(),
            destroy: mock.fn()
        };
        const eventStore = {
            getLatestPosition: mock.fn(async () => null),
            subscribe: mock.fn(() => subscription)
        } as unknown as IEventStore;
        const store = new StoreMock();

        const projection = new Projection(
            {config: {}} as any,
            eventStore,
            'proj',
            1,
            TestProjector,
            store
        );

        await projection.init();
        await projection.stop();

        assert.strictEqual(store.close.mock.callCount(), 1);
        assert.strictEqual(subscription.destroy.mock.callCount(), 1);
    });

    await it('returns proper JSON form and exact display name', async () => {
        const eventStore = {
            getLatestPosition: mock.fn(async () => null),
            subscribe: mock.fn(() => ({
                on: mock.fn(),
                pause: mock.fn(),
                resume: mock.fn(),
                destroy: mock.fn()
            }))
        } as unknown as IEventStore;
        const store = new StoreMock();

        const projection = new Projection(
            {config: {}} as any,
            eventStore,
            'proj',
            1,
            TestProjector,
            store
        );

        await projection.init();
        const json = projection.toJSON();

        assert.deepStrictEqual(json, {
            id: 'proj-1',
            name: 'proj',
            version: 1,
            storeName: undefined,
            isReplaying: false,
            isLiveTracking: true,
            isActive: false,
            latestPosition: '-1n',
            projector: {
                name: 'TestProjector',
                version: 1
            }
        });
        assert.strictEqual(projection.getDisplayName(), 'proj@1');
    });
});
