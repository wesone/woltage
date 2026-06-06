import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';
import mockEventClass from '../../_mock/mockEventClass.ts';
import {STATE_NEW} from '../../../src/adapters/EventStore.ts';

await describe('afterCommandExecution hook', async () => {
    await it('can modify command handler\'s return value', async () => {
        const CommandEvent = mockEventClass('command-test-event');
        const HookEvent = mockEventClass('hook-test-event');

        const hookEvent = new HookEvent({payload: ''});
        const commandEvent = new CommandEvent({payload: ''});

        const pluginRegistry = mockPluginRegistry({
            afterCommandExecution({stateUpdate}) {
                let force = false;
                const events = [hookEvent];
                if(stateUpdate)
                {
                    const {event, force: originalForce} = !('event' in stateUpdate)
                        ? {force: false, event: stateUpdate}
                        : stateUpdate;

                    const originalEvents = !Array.isArray(event) ? [event] : event;
                    events.unshift(...originalEvents);
                    force = originalForce ?? false;
                }

                return {
                    stateUpdate: {
                        force,
                        event: events
                    }
                };
            }
        });

        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            function test()
            {
                return commandEvent;
            }
        );

        const {eventStore} = mockExecutionContext({
            pluginRegistry,
            context: {test: 21}
        });
        const aggregateId = 'a1';
        await aggregate.executeCommand(aggregateId, name, {});

        assert.strictEqual(eventStore.append.mock.callCount(), 1);
        assert.deepStrictEqual(eventStore.append.mock.calls[0].arguments, [
            aggregate.type,
            aggregateId,
            [
                commandEvent,
                hookEvent
            ],
            STATE_NEW
        ]);
    });
});
