import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import Event from '../src/Event.ts';
import z from 'zod';
import mockProjectionContext from './_mock/mockProjectionContext.ts';

describe('Event', async () => {
    const testEventType = 'test.event';
    const testEventVersion = 42;
    class TestEvent extends Event {
        static readonly version = testEventVersion;
    }

    await it('converts event class names to lower case dot separated event types', async () => {
        class SomePascalCaseClassName extends Event {
            static readonly version = 1;
        }
        const eventType = 'some.pascal.case.class.name';
        assert.strictEqual(SomePascalCaseClassName.toString(), eventType);
        assert.strictEqual(new SomePascalCaseClassName({payload: null}).toString(), eventType);

        class mixedCASE42 extends Event {
            static readonly version = 1;
        }
        assert.strictEqual(mixedCASE42.toString(), 'mixed.c.a.s.e42');
    });

    await it('getDisplayName - returns @ separated event type and version', async () => {
        const displayName = `${testEventType}@${testEventVersion}`;

        assert.strictEqual(TestEvent.getDisplayName(), displayName);
        assert.strictEqual(new TestEvent({payload: null}).getDisplayName(), displayName);
    });

    await it('identity - returns stringified event type and version', async () => {
        const identity = `{"type":"${testEventType}","version":${testEventVersion}}`;

        assert.strictEqual(TestEvent.identity, identity);
        assert.strictEqual(new TestEvent({payload: null}).identity, identity);
    });

    await it('fromJSON - constructs event from event data', async () => {
        assert.strictEqual(
            Event.fromJSON({
                id: 'eventId1',
                type: 'test.event',
                version: 42,
                timestamp: '2023-04-23T08:42:00.000Z',
                aggregateId: 'aggregateId1',
                payload: {},
                correlationId: 'eventId1',
                causationId: null,
                meta: {},
                position: 1n
            }, false).identity,
            '{"type":"test.event","version":42}'
        );
    });

    await it('fromJSON - constructs event from event instance', async () => {
        assert.strictEqual(
            Event.fromJSON(new TestEvent({aggregateId: 'aggregateId', payload: null}), false).identity,
            '{"type":"test.event","version":42}'
        );
    });

    await it('toJSON - fails if no aggregateId was set', async () => {
        assert.throws(() => new TestEvent({payload: null}).toJSON());
        assert.doesNotThrow(() => new TestEvent({aggregateId: 'aggregateId', payload: null}).toJSON());
        assert.doesNotThrow(() => {
            const event = new TestEvent({payload: null});
            event.aggregateId = 'aggregateId';
            event.toJSON();
        });
    });

    describe('constructor', async () => {
        await it('throws if static version property is not a number > 0', async () => {
            assert.throws(() => {
                class TestEvent extends Event {}
                new TestEvent({payload: null});
            });
            assert.throws(() => {
                // @ts-expect-error static version property needs to be a number
                class TestEvent extends Event {
                    static readonly version = '42';
                }
                new TestEvent({payload: null});
            });
            assert.doesNotThrow(() => {
                class TestEvent extends Event {
                    static readonly version = 42;
                }
                new TestEvent({payload: null});
            });
        });

        await it('throws if static schema property is not of type ZodType', async () => {
            assert.throws(() => {
                // @ts-expect-error static schema property needs to be a ZodType
                class TestEvent extends Event {
                    static readonly version = 1;
                    static readonly schema = 42;
                }
                new TestEvent({payload: null});
            });
            assert.throws(() => {
                // @ts-expect-error static schema property needs to be a ZodType
                class TestEvent extends Event {
                    static readonly version = 1;
                    static readonly schema = '42';
                }
                new TestEvent({payload: null});
            });
            assert.doesNotThrow(() => {
                class TestEvent extends Event {
                    static readonly version = 42;
                    static readonly schema = z.any();
                }
                new TestEvent({payload: null});
            });
        });

        await it('throws if event is instantiated with non-matching event type', async () => {
            assert.throws(() => {
                class TestEvent extends Event {
                    static readonly version = 1;
                }
                new TestEvent({type: 'other.test.event', version: 1, payload: null});
            });
        });

        await it('throws if event is instantiated with non-matching event version', async () => {
            assert.throws(() => {
                class TestEvent extends Event {
                    static readonly version = 1;
                }
                new TestEvent({type: 'test.event', version: 2, payload: null});
            });
        });

        await it('enriches event with correlation and causation ID automatically if available', async () => {
            const currentEvent = new TestEvent({correlationId: '42', causationId: '21', payload: null});
            mockProjectionContext({currentEvent});

            assert.strictEqual(new TestEvent({correlationId: 'a', payload: null}).correlationId, 'a');
            assert.strictEqual(new TestEvent({causationId: 'b', payload: null}).causationId, 'b');
            assert.strictEqual(new TestEvent({payload: null}).correlationId, '42');
            assert.strictEqual(new TestEvent({payload: null}).causationId, currentEvent.id);
        });
    });
});
