import {describe, it, mock, afterEach} from 'node:test';
import assert from 'node:assert/strict';

import Aggregate from '../../src/write/Aggregate.ts';
import eventStore from '../_mock/eventStore.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import {executionStorage} from '../../src/localStorages.ts';
import {STATE_NEW} from '../../src/adapters/EventStore.ts';
import z from 'zod';
import StoreMock from '../_mock/StoreMock.ts';
import {snapshotSchema} from '../../src/write/Snapshotter.ts';

describe('Aggregate', async () => {
    afterEach(() => eventStore.mockReset());

    await it('can be created', async () => {
        const aggregate = Aggregate.create('test', {});
        assert.equal(aggregate instanceof Aggregate, true, 'Test aggregate is not an instance of Aggregate');
    });

    await it('can have commands', async () => {
        (executionStorage as any).enterWith({eventStore});

        const initState = {test: 42};
        const aggregate = Aggregate.create('test', {
            $init() {return initState;}
        });
        const command = mock.fn(function doSomething() {});

        const aggregateId = 'a';
        const commandPayload = {cmd: 42};
        const context = {aggregateId, aggregateVersion: 0};
        const execCommand = () => aggregate.executeCommand(aggregateId, command.name, commandPayload);

        // reject as command is currently not known
        await assert.rejects(execCommand);

        // do not reject and execute command
        aggregate.registerCommand(command);
        await assert.doesNotReject(execCommand);

        assert.strictEqual(command.mock.callCount(), 1);
        const call = command.mock.calls[0];
        assert.deepStrictEqual(call.arguments, [initState, commandPayload, context]);
    });

    await it('prevents registering unnamed function as command', async () => {
        const aggregate = Aggregate.create('test', {});
        const cmd = () => {};
        assert.doesNotThrow(() => aggregate.registerCommand(cmd));
        assert.throws(() => aggregate.registerCommand(() => {}));
        assert.doesNotThrow(() => aggregate.registerCommand(() => {}, {name: 'testcommand'}));
    });

    await it('prevents registering commands with the same name', async () => {
        const aggregate = Aggregate.create('test', {});
        assert.doesNotThrow(() => aggregate.registerCommand(function doSomething() {}));
        assert.doesNotThrow(() => aggregate.registerCommand(function doSomethingElse() {}));
        assert.throws(() => aggregate.registerCommand(function doSomething() {}));
        assert.throws(() => aggregate.registerCommand(() => {}, {name: 'doSomethingElse'}));
    });

    await it('returns command infos after registering', async () => {
        const aggregate = Aggregate.create('test', {});
        const schema = z.any();
        const command = function doSomething() {};
        assert.deepEqual(
            aggregate.registerCommand(schema, command),
            {
                aggregate,
                name: command.name,
                schema,
                command,
                options: {}
            }
        );
    });

    await it('constructs aggregate state for commands', async () => {
        (executionStorage as any).enterWith({eventStore});

        const aggregateType = 'test';
        const PetRegisteredEvent = mockEventClass('pet.registered');
        const PetRenamedEvent = mockEventClass('pet.renamed');
        const aggregateId1 = 'aggregateId1';
        const aggregateId2 = 'aggregateId2';
        eventStore.mock({
            [aggregateType]: [
                new PetRegisteredEvent({aggregateId: aggregateId1, payload: {name: 'Lucky'}}),
                new PetRegisteredEvent({aggregateId: aggregateId2, payload: {name: 'Jefferson'}}),
                new PetRenamedEvent({aggregateId: aggregateId2, payload: {name: 'Airplane'}}),
                new PetRenamedEvent({aggregateId: aggregateId1, payload: {name: 'Slevin'}})
            ]
        });

        const aggregate = Aggregate.create(aggregateType, {
            $init() {
                return {
                    eventCount: 0,
                    name: null
                };
            },
            [PetRegisteredEvent.identity](state, event) {
                state.eventCount++;
                state.name = event.payload.name;
                return state;
            },
            [PetRenamedEvent.identity](state, event) {
                state.eventCount++;
                state.name = event.payload.name;
                return state;
            },
        });
        const command = mock.fn(function doSomething() {});
        aggregate.registerCommand(command);

        await aggregate.executeCommand(aggregateId1, command.name, {});
        await aggregate.executeCommand(aggregateId2, command.name, {});

        const expectedState1 = {
            eventCount: 2,
            name: 'Slevin'
        };
        const expectedState2 = {
            eventCount: 2,
            name: 'Airplane'
        };
        assert.deepStrictEqual(command.mock.calls[0].arguments, [expectedState1, {}, {aggregateId: aggregateId1, aggregateVersion: 2}]);
        assert.deepStrictEqual(command.mock.calls[1].arguments, [expectedState2, {}, {aggregateId: aggregateId2, aggregateVersion: 2}]);
    });

    await it('constructs aggregate state and uses `$all` as a fallback handler', async () => {
        (executionStorage as any).enterWith({eventStore});

        const aggregateType = 'test';
        const PetRegisteredEvent = mockEventClass('pet.registered');
        const PetRenamedEvent = mockEventClass('pet.renamed');
        const aggregateId = 'aggregateId1';
        eventStore.mock({
            [aggregateType]: [
                new PetRegisteredEvent({aggregateId, payload: {name: 'Lucky'}}),
                new PetRenamedEvent({aggregateId, payload: {name: 'Slevin'}})
            ]
        });

        const aggregate = Aggregate.create(aggregateType, {
            $init() {
                return {
                    eventCount: 0,
                };
            },
            $all(state) {
                state.eventCount++;
                return state;
            }
        });
        const command = mock.fn(function doSomething() {});
        aggregate.registerCommand(command);

        await aggregate.executeCommand(aggregateId, command.name, {});

        const expectedState = {
            eventCount: 2
        };
        assert.deepStrictEqual(
            command.mock.calls[0].arguments,
            [expectedState, {}, {aggregateId, aggregateVersion: 2}]
        );
    });

    await it('constructs aggregate state even if no handler exists', async () => {
        (executionStorage as any).enterWith({eventStore});

        const aggregateType = 'test';
        const PetRegisteredEvent = mockEventClass('pet.registered');
        const PetRenamedEvent = mockEventClass('pet.renamed');
        const aggregateId = 'aggregateId1';
        eventStore.mock({
            [aggregateType]: [
                new PetRegisteredEvent({aggregateId, payload: {name: 'Lucky'}}),
                new PetRenamedEvent({aggregateId, payload: {name: 'Slevin'}})
            ]
        });

        const aggregate = Aggregate.create(aggregateType, {
            $init() {
                return {
                    eventCount: 0,
                    name: null
                };
            }
        });
        const command = mock.fn(function doSomething() {});
        aggregate.registerCommand(command);

        await aggregate.executeCommand(aggregateId, command.name, {});

        assert.deepStrictEqual(
            command.mock.calls[0].arguments,
            [aggregate.projector.$init?.(), {}, {aggregateId, aggregateVersion: 2}]
        );
    });

    await it('does not swallow exceptions that occur in aggregate projector', async () => {
        (executionStorage as any).enterWith({eventStore});

        const TestEvent = mockEventClass('test');
        const aggregateType = 'test';
        const aggregateId = 'aggregateId1';
        eventStore.mock({
            [aggregateType]: [
                new TestEvent({aggregateId, payload: {}})
            ]
        });
        const aggregate = Aggregate.create(aggregateType, {
            [TestEvent.identity]() {
                throw new Error('Test error');
            }
        });
        const command = mock.fn(function doSomething() {});
        aggregate.registerCommand(command);

        await assert.rejects(() => aggregate.executeCommand(aggregateId, command.name, {}));
    });

    describe('commands', async () => {
        const initState = {test: 42};
        const aggregate = Aggregate.create('test', {
            $init() {return initState;}
        });
        const TestEvent = mockEventClass('test');
        const {name: commandName} = aggregate.registerCommand(
            function doSomething(state: any, payload: any) {
                return new TestEvent({
                    payload: {commandValue: payload?.cmd}
                });
            }
        );

        await it('can append an event', async () => {
            (executionStorage as any).enterWith({eventStore});

            const commandPayload = {cmd: 21};
            const aggregateId = 'fourtytwo';

            await assert.doesNotReject(() => aggregate.executeCommand(aggregateId, commandName, commandPayload));

            assert.strictEqual(eventStore.append.mock.callCount(), 1);
            assert.partialDeepStrictEqual(
                eventStore.append.mock.calls[0].arguments,
                [
                    aggregate.type,
                    aggregateId,
                    [{aggregateId, payload: {commandValue: commandPayload.cmd}}],
                    STATE_NEW
                ]
            );
        });

        await it('can append multiple events', async () => {
            (executionStorage as any).enterWith({eventStore});

            const {name: commandName} = aggregate.registerCommand(
                function multipleEvents(state: any, payload: any) {
                    return [
                        new TestEvent({
                            payload: {commandValue: payload?.cmd}
                        }),
                        new TestEvent({
                            payload: {commandValue: '2nd'}
                        })
                    ];
                }
            );

            const commandPayload = {cmd: 21};
            const aggregateId = 'fourtytwo';

            await assert.doesNotReject(() => aggregate.executeCommand(aggregateId, commandName, commandPayload));

            assert.strictEqual(eventStore.append.mock.callCount(), 1);
            assert.partialDeepStrictEqual(
                eventStore.append.mock.calls[0].arguments,
                [
                    aggregate.type,
                    aggregateId,
                    [
                        {aggregateId, payload: {commandValue: commandPayload.cmd}},
                        {aggregateId, payload: {commandValue: '2nd'}}
                    ],
                    STATE_NEW
                ]
            );
        });

        await it('validate payload against schema', async () => {
            (executionStorage as any).enterWith({eventStore});

            const aggregate = Aggregate.create('test', {});
            const command = () => {};
            aggregate.registerCommand(
                z.object({
                    num: z.number(),
                }),
                command
            );
            const aggregateId = 'fourtytwo';

            await assert.rejects(() => aggregate.executeCommand(aggregateId, command.name, {}));
            await assert.rejects(() => aggregate.executeCommand(aggregateId, command.name, {num: '42'}));
            await assert.doesNotReject(() => aggregate.executeCommand(aggregateId, command.name, {num: 42}));
        });

        await it('use optimistic concurrency control per aggregate id', async () => {
            (executionStorage as any).enterWith({eventStore});

            const aggregateId = 'fourtytwo';

            const results = await Promise.allSettled([
                aggregate.executeCommand(aggregateId, commandName, {}),
                aggregate.executeCommand('twentyone', commandName, {}),
                aggregate.executeCommand(aggregateId, commandName, {})
            ]);

            assert.strictEqual(eventStore.append.mock.callCount(), 3);
            assert.strictEqual(results.filter(({status}) => status === 'fulfilled').length, 2);
            assert.strictEqual(results.filter(({status}) => status === 'rejected').length, 1);
        });

        await it('skip optimistic concurrency control if force flag is `true`', async () => {
            const {name: commandName} = aggregate.registerCommand(
                function forceSomething(state: any, payload: any) {
                    return {
                        force: true,
                        event: new TestEvent({
                            payload: {commandValue: payload?.cmd}
                        })
                    };
                }
            );

            (executionStorage as any).enterWith({eventStore});

            const aggregateId = 'fourtytwo';

            const results = await Promise.allSettled([
                aggregate.executeCommand(aggregateId, commandName, {}),
                aggregate.executeCommand('twentyone', commandName, {}),
                aggregate.executeCommand(aggregateId, commandName, {})
            ]);

            assert.strictEqual(eventStore.append.mock.callCount(), 3);
            assert.strictEqual(results.filter(({status}) => status === 'fulfilled').length, 3);
            assert.strictEqual(results.filter(({status}) => status === 'rejected').length, 0);
        });
    });

    await it('uses existing snapshot to prevent aggregating the whole stream', async () => {
        (executionStorage as any).enterWith({eventStore});

        const aggregateType = 'test';
        const PetRegisteredEvent = mockEventClass('pet.registered');
        const PetRenamedEvent = mockEventClass('pet.renamed');
        const aggregateId = 'aggregateId1';
        eventStore.mock({
            [aggregateType]: [
                new PetRegisteredEvent({aggregateId, payload: {name: 'Lucky'}}),
                new PetRenamedEvent({aggregateId, payload: {name: 'Jefferson'}}),
                new PetRenamedEvent({aggregateId, payload: {name: 'Airplane'}}),
                new PetRenamedEvent({aggregateId, payload: {name: 'Slevin'}})
            ]
        });

        const aggregate = Aggregate.create(aggregateType, {
            $init() {
                return {
                    eventCount: 0,
                    name: null
                };
            },
            [PetRegisteredEvent.identity](state, event) {
                state.eventCount++;
                state.name = event.payload.name;
                return state;
            },
            [PetRenamedEvent.identity](state, event) {
                state.eventCount++;
                state.name = event.payload.name;
                return state;
            },
        });
        let resultState = {};
        const command = mock.fn(function doSomething(state) {resultState = state;});
        aggregate.registerCommand(command);

        aggregate.snapshotter.configure({eventCount: 100});
        const storeMock = new StoreMock<typeof snapshotSchema>();
        await aggregate.snapshotter.setStore(storeMock);
        await aggregate.snapshotter.set({
            aggregateId,
            projectorVersion: 0,
            aggregateType,
            aggregateVersion: 2,
            revision: 2n,
            timestamp: Date.now(),
            state: {
                eventCount: 2,
                name: 'Jefferson',
                fromSnapshot: true
            }
        });

        await aggregate.executeCommand(aggregateId, command.name, {});
        assert.deepStrictEqual((resultState as any).fromSnapshot, true);
    });
});
