import {describe, it, mock, after, type Mock} from 'node:test';
import assert from 'node:assert/strict';

import EventRegistry from '../src/EventRegistry.ts';
import mockEventClass from './_mock/mockEventClass.ts';

import EventCaster from '../src/EventCaster.ts';
import Event from '../src/Event.ts';

describe('EventRegistry', async () => {
    after(() => mock.reset());

    await it('can be created with a plain object', async () => {
        const plainObject = {
            a: 42,
            b: () => {},
            [mockEventClass('test.identity', 42).identity]: () => {},
            '{"type":"not.an.identity","veron":21}': () => {},
            '{"type":"","version":21}': () => {}
        };
        assert.deepStrictEqual(new EventRegistry(plainObject).types, ['test.identity'], 'EventRegistry has unexpected types');
    });

    await it('can be created with a complex object', async () => {
        class TestClass {
            a = 42;
            b() {}
            [mockEventClass('test.identity', 42).identity]() {}
            '{"type":"not.an.identity","veron":21}'() {}
            '{"type":"","version":21}'() {};
        }
        assert.deepStrictEqual(new EventRegistry(TestClass).types, [], 'EventRegistry has unexpected types');
        assert.deepStrictEqual(new EventRegistry(TestClass, TestClass.prototype).types, ['test.identity'], 'EventRegistry has unexpected types');
    });

    await it('will return the correct handler based on an event', async () => {
        const TestEvent1 = mockEventClass('test.event', 1);
        const handler1 = mock.fn();
        const TestEvent2 = mockEventClass('test.event', 2);
        const handler2 = mock.fn();
        const TestEvent3 = mockEventClass('test.event.unknown.type', 3);
        const registry = new EventRegistry({
            [TestEvent1.identity]: handler1,
            [TestEvent2.identity]: handler2
        });

        (await registry.get(new TestEvent1({payload: {}}))).handler?.();
        assert.strictEqual(handler1.mock.callCount(), 1);

        (await registry.get(new TestEvent2({payload: {}}))).handler?.();
        assert.strictEqual(handler2.mock.callCount(), 1);

        const event = new TestEvent3({payload: {}});
        assert.deepStrictEqual(
            await registry.get(event),
            {
                event,
                handler: undefined
            }
        );
    });

    await it('will cast an event if no handler for that version is registered', async () => {
        mock.method(
            EventCaster,
            'cast',
            (event: Event, targetVersion: number) => {
                const EventClass = mockEventClass(event.type, targetVersion);
                return new EventClass({...event.toJSON(), version: targetVersion});
            }
        );

        const TestEvent1 = mockEventClass('test.event', 1);
        const handler1 = mock.fn();
        const TestEvent2 = mockEventClass('test.event', 2);
        const registry = new EventRegistry({
            [TestEvent1.identity]: handler1
        });

        (await registry.get(new TestEvent2({aggregateId: 'aggregateId1', payload: {}}))).handler?.();
        assert.strictEqual(handler1.mock.callCount(), 1);
        assert.strictEqual((EventCaster.cast as Mock<typeof EventCaster.cast>).mock.callCount(), 1);
    });
});
