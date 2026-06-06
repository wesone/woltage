import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('beforeCommandExecution hook', async () => {
    await it('can modify command values before handler execution', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeCommandExecution({payload, state, context}) {
                return {
                    payload: {
                        ...(payload as Record<string, unknown>),
                        transformed: true
                    },
                    state: {
                        ...(state as Record<string, unknown>),
                        transformed: true
                    },
                    context: {
                        ...context,
                        transformed: true
                    }
                };
            }
        });

        let receivedArgs: unknown;
        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            function test(state, payload, context)
            {
                receivedArgs = [state, payload, context];
            }
        );

        mockExecutionContext({
            pluginRegistry,
            context: {test: 21}
        });
        const aggregateId = 'a1';
        await aggregate.executeCommand(aggregateId, name, {test: 42});

        assert.deepStrictEqual(receivedArgs, [
            {
                transformed: true
            },
            {
                test: 42,
                transformed: true
            },
            {
                aggregateId,
                aggregateVersion: 0,
                test: 21,
                transformed: true
            }
        ]);
    });
});
