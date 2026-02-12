import {afterEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import eventMap, {registerEventClasses, getEventClass} from '../src/eventMap.ts';
import mockEventClass from './_mock/mockEventClass.ts';

describe('eventMap', async () => {
    afterEach(() => {
        for(const key in eventMap)
            delete eventMap[key];
    });

    describe('registerEventClasses', async () => {
        await it('checks for duplicate events', async () => {
            assert.throws(() => {
                registerEventClasses([
                    mockEventClass('test.event', 1),
                    mockEventClass('test.event', 2),
                    mockEventClass('other.test.event', 2),
                    mockEventClass('test.event', 1)
                ]);
            });
            assert.throws(() => {
                registerEventClasses([
                    mockEventClass('test.event', 1),
                    mockEventClass('test.event', 2),
                    mockEventClass('other.test.event', 2),
                    mockEventClass('test.event', 3)
                ]);
            });
        });
    });

    describe('getEventClass', async () => {
        await it('returns an event class even for unregistered event classes', async () => {
            const testEvent = mockEventClass('test.event', 2);
            registerEventClasses([
                mockEventClass('test.event', 1),
                testEvent
            ]);
            assert.strictEqual(getEventClass('test.event', 2), testEvent);

            const unknownEvent = getEventClass('test.event', 42);
            assert.strictEqual(unknownEvent.version, 42);
        });
    });
});
