import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import Projector from '../../src/read/Projector.ts';
import type Event from '../../src/Event.ts';
import StoreMock from '../_mock/StoreMock.ts';
import mockEventClass from '../_mock/mockEventClass.ts';

await describe('Projector', async () => {
    await it('throws if schema is invalid', async () => {
        class InvalidProjector extends Projector {}

        assert.throws(
            () => new InvalidProjector(new StoreMock()),
            /Projector's schema property is invalid\./
        );
    });

    await it('throws if version is invalid', async () => {
        class InvalidProjector extends Projector {
            static schema = {};
            static version = 0;
        }

        assert.throws(
            () => new InvalidProjector(new StoreMock()),
            /Projector's version property must be a number > 0\./
        );
    });

    await it('exposes types of registered event handlers and store tables', async () => {
        const TestEvent = mockEventClass('test.event', 1);
        const eventHandler = mock.fn();

        class TestProjector extends Projector {
            static schema = {};
            static version = 1;

            [TestEvent.identity](event: Event) {
                eventHandler(event);
            }
        }

        const store = new StoreMock();
        const projector = new TestProjector(store);

        assert.deepStrictEqual(projector.types, [TestEvent.type]);
        assert.strictEqual(projector.tables, store.tables);
    });

    await it('calls the registered handler for a matching event', async () => {
        const TestEvent = mockEventClass('test.event', 1);
        const eventHandler = mock.fn();

        class TestProjector extends Projector {
            static schema = {};
            static version = 1;

            [TestEvent.identity](event: Event) {
                eventHandler(event);
            }
        }

        const projector = new TestProjector(new StoreMock());
        const event = new TestEvent({aggregateId: 'aggregateId', payload: {}});

        await projector.onEvent(event);

        assert.strictEqual(eventHandler.mock.callCount(), 1);
        assert.deepStrictEqual(eventHandler.mock.calls[0].arguments, [event]);
    });

    await it('uses eventCastingFallback when version is not handled directly', async () => {
        const EventV1 = mockEventClass('test.event', 1);
        const EventV2 = mockEventClass('test.event', 2);
        const eventHandler = mock.fn();
        const castFallback = mock.fn(async (event: Event, targetVersion: number) => {
            return new EventV1({...event.toJSON(), version: targetVersion});
        });

        class TestProjector extends Projector {
            static schema = {};
            static version = 1;

            [EventV1.identity](event: Event) {
                eventHandler(event);
            }
        }

        const projector = new TestProjector(new StoreMock(), castFallback);
        const event = new EventV2({aggregateId: 'aggregateId', payload: {}});

        await projector.onEvent(event);

        assert.strictEqual(castFallback.mock.callCount(), 1);
        assert.strictEqual(eventHandler.mock.callCount(), 1);
        assert.strictEqual(eventHandler.mock.calls[0].arguments[0].version, 1);
    });

    await it('returns a display name that includes class name and version', async () => {
        class TestProjector extends Projector {
            static schema = {};
            static version = 1;
        }

        const projector = new TestProjector(new StoreMock());

        assert.strictEqual(projector.getDisplayName(), 'TestProjector@1');
    });
});
