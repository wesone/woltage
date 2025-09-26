import {describe, it, mock, after} from 'node:test';
import assert from 'node:assert/strict';

import Aggregate from '../../src/write/Aggregate.ts';
import mockEventStore from '../_mock/mockEventStore.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import {STATE_NEW} from '../../src/adapters/EventStore.ts';
import {z} from 'zod/v4';

describe('Aggregate', async () => {
    after(() => mock.reset());

    await it('can be created', async () => {
        const aggregate = Aggregate.create('test', {});
        assert.equal(aggregate instanceof Aggregate, true, 'Test aggregate is not an instance of Aggregate');
    });

    await it('can have commands', async () => {
        mockEventStore();
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
        assert.doesNotThrow(() => aggregate.registerCommand(() => {}, {commandName: 'testcommand'}));
    });

    await it('prevents registering commands with the same name', async () => {
        const aggregate = Aggregate.create('test', {});
        assert.doesNotThrow(() => aggregate.registerCommand(function doSomething() {}));
        assert.doesNotThrow(() => aggregate.registerCommand(function doSomethingElse() {}));
        assert.throws(() => aggregate.registerCommand(function doSomething() {}));
        assert.throws(() => aggregate.registerCommand(() => {}, {commandName: 'doSomethingElse'}));
    });

    await it('returns command infos after registering', async () => {
        const aggregate = Aggregate.create('test', {});
        const schema = z.any();
        const command = function doSomething() {};
        assert.deepEqual(aggregate.registerCommand(schema, command), {
            name: command.name,
            schema,
            command,
            options: {}
        });
    });

    await it('constructs aggregate state for commands', async () => {
        const aggregateName = 'test';
        const PetRegisteredEvent = mockEventClass('pet.registered');
        const PetRenamedEvent = mockEventClass('pet.renamed');
        const aggregateId1 = 'uuid1';
        const aggregateId2 = 'uuid2';
        mockEventStore({
            [aggregateName]: [
                new PetRegisteredEvent({aggregateId: aggregateId1, payload: {name: 'Lucky'}}),
                new PetRegisteredEvent({aggregateId: aggregateId2, payload: {name: 'Jefferson'}}),
                new PetRenamedEvent({aggregateId: aggregateId2, payload: {name: 'Airplane'}}),
                new PetRenamedEvent({aggregateId: aggregateId1, payload: {name: 'Slevin'}})
            ]
        });

        const aggregate = Aggregate.create(aggregateName, {
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

    await it('does not swallow exceptions that occur in aggregate projector', async () => {
        const TestEvent = mockEventClass('test');
        const aggregateName = 'test';
        const aggregateId = 'uuid1';
        mockEventStore({
            [aggregateName]: [
                new TestEvent({aggregateId, payload: {}})
            ]
        });
        const aggregate = Aggregate.create(aggregateName, {
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
        const command = function doSomething(state, payload) {
            return new TestEvent({
                payload: {commandValue: payload?.cmd}
            });
        };
        aggregate.registerCommand(command);

        await it('can append events', async () => {
            const EventStore = mockEventStore();
            const commandPayload = {cmd: 21};
            const aggregateId = 'fourtytwo';

            await assert.doesNotReject(() => aggregate.executeCommand(aggregateId, command.name, commandPayload));

            assert.strictEqual(EventStore.append.mock.callCount(), 1);
            assert.partialDeepStrictEqual(
                EventStore.append.mock.calls[0].arguments,
                [
                    aggregate.name,
                    aggregateId,
                    [{aggregateId, payload: {commandValue: commandPayload.cmd}}],
                    STATE_NEW
                ]
            );
        });

        await it('use optimistic concurrency control per aggregate id', async () => {
            const EventStore = mockEventStore();
            const aggregateId = 'fourtytwo';

            const results = await Promise.allSettled([
                aggregate.executeCommand(aggregateId, command.name, {}),
                aggregate.executeCommand('twentyone', command.name, {}),
                aggregate.executeCommand(aggregateId, command.name, {})
            ]);

            assert.strictEqual(EventStore.append.mock.callCount(), 3);
            assert.strictEqual(results.filter(({status}) => status === 'fulfilled').length, 2);
            assert.strictEqual(results.filter(({status}) => status === 'rejected').length, 1);
        });

        await it('validate payload against schema', async () => {
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
    });
});
