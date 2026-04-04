import {afterEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';

import z from 'zod';
import EventCaster, {extractZodTypeInfo} from '../src/EventCaster.ts';
import eventMap, {registerEventClasses} from '../src/eventMap.ts';
import mockEventClass from './_mock/mockEventClass.ts';

await describe('EventCaster', async () => {
    function buildDeepObjectSchema(depth: number)
    {
        let schema: z.ZodType = z.object({});
        for(let i = 0; i < depth; i++)
            schema = z.object({value: schema});
        return schema;
    }

    function buildDeepObject(depth: number)
    {
        const obj: any = {};
        let current = obj;
        for(let i = 0; i < depth; i++)
            current = current.value = {};
        return obj;
    }

    await describe('analyze', async () => {
        const cases = [
            {
                name: 'detects type mismatch',
                source: z.string(),
                target: z.number(),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.TYPE_MISMATCH]
            },
            {
                name: 'detects added required field in UP direction',
                source: z.object({name: z.string()}),
                target: z.object({name: z.string(), age: z.number()}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.REQUIRED_FIELD_ADDED]
            },
            {
                name: 'allows added optional field in UP direction',
                source: z.object({name: z.string()}),
                target: z.object({name: z.string(), age: z.number().optional()}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'detects removed required field in DOWN direction',
                source: z.object({name: z.string(), age: z.number()}),
                target: z.object({name: z.string()}),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.REQUIRED_FIELD_REMOVED]
            },
            {
                name: 'detects field becoming required without default in UP direction',
                source: z.object({age: z.number().optional()}),
                target: z.object({age: z.number()}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.FIELD_NOW_REQUIRED]
            },
            {
                name: 'allows field becoming required with default in UP direction',
                source: z.object({age: z.number().optional()}),
                target: z.object({age: z.number().default(0)}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'detects removed variant in UP direction',
                source: z.enum(['a', 'b', 'c']),
                target: z.enum(['a', 'b']),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.VARIANT_REMOVED]
            },
            {
                name: 'detects added variant in DOWN direction',
                source: z.enum(['a', 'b']),
                target: z.enum(['a', 'b', 'c']),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.VARIANT_ADDED]
            },
            {
                name: 'detects narrowed string length in UP direction',
                source: z.string().min(1).max(10),
                target: z.string().min(5).max(10),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_NARROWED]
            },
            {
                name: 'detects widened string length in DOWN direction',
                source: z.string().min(5).max(10),
                target: z.string().min(1).max(10),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                name: 'detects narrowed number range in UP direction',
                source: z.number().min(0).max(100),
                target: z.number().min(10).max(50),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_NARROWED]
            },
            {
                name: 'detects widened number range in DOWN direction',
                source: z.number().min(10).max(50),
                target: z.number().min(0).max(100),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                name: 'detects narrowed number type (float to int) in UP direction',
                source: z.number(),
                target: z.int(),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_NARROWED]
            },
            {
                name: 'detects widened number type (int to float) in DOWN direction',
                source: z.int(),
                target: z.number(),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                // ZodNumber.minValue/maxValue type definition says number | null,
                // but in practice it seems to be always a number (defaulting to -Infinity/Infinity if not set),
                // so this test just ensures that if they are null it doesn't cause unexpected errors.
                name: 'handles inexact number bounds (minValue/maxValue null) gracefully',
                source: (() => { const s = z.number(); (s as any).minValue = null; (s as any).maxValue = null; return s; })(),
                target: (() => { const t = z.number(); (t as any).minValue = null; (t as any).maxValue = null; return t; })(),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'detects incompatible union in UP direction',
                source: z.union([z.string(), z.number()]),
                target: z.union([z.string()]),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                name: 'allows compatible union in UP direction',
                source: z.union([z.string(), z.number()]),
                target: z.union([z.string(), z.number(), z.boolean()]),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'detects added union option in DOWN direction',
                source: z.union([z.string(), z.number()]),
                target: z.union([z.string(), z.number(), z.boolean()]),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                name: 'detects different literal values',
                source: z.literal('a'),
                target: z.literal('b'),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.SCALAR_TYPE_WIDENED]
            },
            {
                name: 'handles arrays recursively',
                source: z.array(z.string()),
                target: z.array(z.number()),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: [EventCaster.CASTING_ERRORS.TYPE_MISMATCH]
            },
            {
                name: 'allows compatible schemas',
                source: z.object({name: z.string()}),
                target: z.object({name: z.string()}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'allows renaming of properties when upcasting',
                source: z.object({
                    pop: z.string(),
                    prop: z.boolean().optional()
                }),
                target: z.object({
                    prop: z.string().meta({renamedFrom: 'pop'}),
                    pop: z.number().optional()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            },
            {
                name: 'allows renaming of properties when downcasting',
                source: z.object({
                    prop: z.string().meta({renamedFrom: 'pop'}),
                    pop: z.number().optional()
                }),
                target: z.object({
                    pop: z.string(),
                    prop: z.boolean().optional()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                errors: []
            },
            {
                name: 'allows compatible schemas (that don\'t require special handling)',
                source: z.object({name: z.boolean()}),
                target: z.object({name: z.boolean()}),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                errors: []
            }
        ];
        for(const {name, source, target, direction, errors} of cases)
        {
            await it(name, async () => {
                const actualErrors = EventCaster.analyze(direction, source, target);
                assert.strictEqual(actualErrors.length, errors.length, `Should have ${errors.length} errors. Actual errors: ${actualErrors.map(e => e.message).join(', ')}`);
                for(let i = 0; i < errors.length; i++)
                    assert.strictEqual(actualErrors[i].message, errors[i], `Error ${i} should be "${errors[i]}"`);
            });
        }

        await it('throws for nested schemas that exceed depth limit', async () => {
            const deepSchema = buildDeepObjectSchema(22);
            assert.throws(
                () => EventCaster.analyze(EventCaster.CASTING_DIRECTIONS.UP, deepSchema, deepSchema),
                /Recursion depth exceeded/,
                'Should throw recursion depth exceeded'
            );
        });

        await it('stops unwrap loop when unwrap returns same schema', async () => {
            const schema = z.string().optional();
            Object.defineProperty(schema, 'unwrap', {
                value() {
                    return schema;
                },
                writable: false,
                configurable: true
            });

            const info = extractZodTypeInfo(schema);
            assert.strictEqual(info.type, 'optional');
            assert.strictEqual(info.isOptional, true);
            assert.strictEqual(info.innerSchema, schema, 'innerSchema should remain the same if unwrap is self-referential');
        });
    });

    await describe('isCastable', async () => {
        await it('returns true for compatible schemas', async () => {
            const source = z.object({name: z.string()});
            const target = z.object({name: z.string()});
            const result = EventCaster.isCastable(EventCaster.CASTING_DIRECTIONS.UP, source, target);
            assert.strictEqual(result, true, 'Should be castable');
        });

        await it('returns false for incompatible schemas', async () => {
            const source = z.string();
            const target = z.number();
            const result = EventCaster.isCastable(EventCaster.CASTING_DIRECTIONS.UP, source, target);
            assert.strictEqual(result, false, 'Should not be castable');
        });

        await it('returns false for non-Zod schemas', async () => {
            const source = {type: 'string'}; // not Zod
            const target = z.string();
            const result = EventCaster.isCastable(EventCaster.CASTING_DIRECTIONS.UP, source as any, target);
            assert.strictEqual(result, false, 'Should not be castable for non-Zod');
        });
    });

    await describe('transform', async () => {
        const deepSchema = buildDeepObjectSchema(22);

        const cases = [
            {
                name: 'handles renamed properties when upcasting',
                source: z.object({
                    pop: z.string(),
                    prop: z.boolean().optional()
                }),
                target: z.object({
                    prop: z.string().meta({renamedFrom: 'pop'}),
                    pop: z.number().optional()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {pop: '42', prop: true},
                expected: {prop: '42'}
            },
            {
                name: 'ignores renamed properties when downcasting',
                source: z.object({
                    pop: z.string(),
                    prop: z.boolean().optional()
                }),
                target: z.object({
                    prop: z.string().meta({renamedFrom: 'pop'}),
                    pop: z.number().optional()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                payload: {prop: '42', pop: 42},
                expected: {prop: '42', pop: 42}
            },
            {
                name: 'adds defaults when upcasting',
                source: z.object({
                    a: z.string().optional()
                }),
                target: z.object({
                    b: z.string().default('default')
                }),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {},
                expected: {b: 'default'}
            },
            {
                name: 'adds defaults when downcasting',
                source: z.object({
                    a: z.string().optional()
                }),
                target: z.object({
                    b: z.string().default('default')
                }),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                payload: {},
                expected: {b: 'default'}
            },
            {
                name: 'removes unknown properties when upcasting',
                source: z.object({
                    a: z.string(),
                    b: z.string().optional()
                }),
                target: z.object({
                    a: z.string()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {a: 'known', b: 'unknown'},
                expected: {a: 'known'}
            },
            {
                name: 'removes unknown properties when downcasting',
                source: z.object({
                    a: z.string(),
                    b: z.string().optional()
                }),
                target: z.object({
                    a: z.string()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.DOWN,
                payload: {a: 'known', b: 'unknown'},
                expected: {a: 'known'}
            },
            {
                name: 'handles arrays by transforming each item',
                source: z.array(
                    z.object({
                        a: z.string(),
                        b: z.string().optional()
                    })
                ),
                target: z.array(
                    z.object({
                        a: z.string()
                    })
                ),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: [{a: 'known', b: 'unknown'}],
                expected: [{a: 'known'}]
            },
            {
                name: 'ignores mismatching types when strict mode disabled',
                source: z.array(z.string()),
                target: z.array(z.string()),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {a: 'unknown'},
                expected: {a: 'unknown'}
            },
            {
                name: 'throws for mismatching types when strict mode enabled',
                source: z.array(z.string()),
                target: z.array(z.string()),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {a: 'unknown'},
                error: true,
                strict: true
            },
            {
                name: 'throws for missing required fields when strict mode enabled',
                source: z.object({
                    a: z.string()
                }),
                target: z.object({
                    b: z.string()
                }),
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: {a: 'unknown'},
                error: true,
                strict: true
            },
            {
                name: 'throws for nested schemas that exceed depth limit',
                source: deepSchema,
                target: deepSchema,
                direction: EventCaster.CASTING_DIRECTIONS.UP,
                payload: buildDeepObject(22),
                error: true
            }
        ];
        for(const {name, source, target, direction, payload, expected, error = false, strict = false} of cases)
        {
            await it(name, async () => {
                const fn = () => EventCaster.transform(direction, source, target, payload, strict);
                if(error)
                    assert.throws(fn, 'Expected error was not thrown');
                else
                    assert.deepStrictEqual(fn(), expected, 'Transformed payload should match expected value');
            });
        }
    });

    await describe('cast', async () => {
        const eventType = 'test.event';

        afterEach(() => {
            // clear eventMap after each test
            for(const key in eventMap)
                delete eventMap[key];
        });

        await it('casts up an event payload according to target schema', async () => {
            const EventV1 = mockEventClass(eventType, 1, z.object({
                a: z.string(),
                b: z.number()
            }));
            registerEventClasses([
                EventV1,
                mockEventClass(eventType, 2, z.object({
                    c: z.string().meta({renamedFrom: 'a'}),
                    d: z.number().default(42),
                    e: z.boolean().optional()
                })),
                mockEventClass(eventType, 3, z.object({
                    c: z.string(),
                    e: z.boolean().optional(),
                    f: z.number().meta({renamedFrom: 'd'}),
                    g: z.string().default('default')
                }))
            ]);

            const caster = new EventCaster(eventMap);
            const event = new EventV1({aggregateId: 'aggregateId', payload: {
                a: 'value',
                b: 10
            }});
            assert.deepStrictEqual(
                (await caster.cast(event, 3)).payload,
                {
                    c: 'value',
                    f: 42,
                    g: 'default'
                }
            );
        });

        await it('casts down an event payload according to target schema', async () => {
            const EventV3 = mockEventClass(eventType, 3, z.object({
                c: z.string(),
                e: z.boolean().optional(),
                f: z.number().meta({renamedFrom: 'd'}),
                g: z.string().default('default')
            }));
            registerEventClasses([
                EventV3,
                mockEventClass(eventType, 2, z.object({
                    c: z.string().meta({renamedFrom: 'a'}),
                    d: z.number().default(42),
                    e: z.boolean().optional()
                })),
                mockEventClass(eventType, 1, z.object({
                    a: z.string(),
                    b: z.number().optional()
                }))
            ]);

            const caster = new EventCaster(eventMap);
            const event = new EventV3({aggregateId: 'aggregateId', payload: {
                c: 'value',
                e: true,
                f: 42,
                g: 'test'
            }});
            assert.deepStrictEqual(
                (await caster.cast(event, 1)).payload,
                {
                    a: 'value'
                }
            );
        });

        await it('does not modify the original event when casting', async () => {
            const EventV1 = mockEventClass(eventType, 1, z.object({a: z.string()}));
            const EventV2 = mockEventClass(eventType, 2, z.object({b: z.string().meta({renamedFrom: 'a'})}));
            registerEventClasses([EventV1, EventV2]);

            const caster = new EventCaster(eventMap);
            const event = new EventV1({aggregateId: 'aggregateId', payload: {a: 'value'}});
            const castEvent = await caster.cast(event, 2);
            assert.deepStrictEqual(event.payload, {a: 'value'}, 'Original event payload should not be modified');
            assert.deepStrictEqual(castEvent.payload, {b: 'value'}, 'Cast event payload should be different');
        });

        await it('handles same target version as current event version', async () => {
            const EventV1 = mockEventClass(eventType, 1, z.object({a: z.string()}));
            const EventV2 = mockEventClass(eventType, 2, z.object({b: z.string().meta({renamedFrom: 'a'})}));
            registerEventClasses([EventV1, EventV2]);

            const caster = new EventCaster(eventMap);
            const event = new EventV1({aggregateId: 'aggregateId', payload: {a: 'value'}});
            const castEvent = await caster.cast(event, 1);
            assert.deepStrictEqual(event.payload, {a: 'value'}, 'Original event payload should not be modified');
            assert.deepStrictEqual(castEvent.payload, {a: 'value'}, 'Cast event payload should be the same');
        });

        await it('throws for unknown event versions', async () => {
            const EventV1 = mockEventClass(eventType, 1, z.object({a: z.string()}));
            const EventV2 = mockEventClass(eventType, 2, z.object({b: z.string().meta({renamedFrom: 'a'})}));
            registerEventClasses([EventV1, EventV2]);
            const EventV3 = mockEventClass(eventType, 3, z.object({c: z.string().meta({renamedFrom: 'b'})}));

            const caster = new EventCaster(eventMap);
            assert.doesNotReject(() => caster.cast(new EventV1({aggregateId: 'aggregateId', payload: {a: 'value'}}), 2));
            assert.rejects(() => caster.cast(new EventV1({aggregateId: 'aggregateId', payload: {a: 'value'}}), 3));
            assert.rejects(() => caster.cast(new EventV3({aggregateId: 'aggregateId', payload: {c: 'value'}}), 1));
        });
    });
});
