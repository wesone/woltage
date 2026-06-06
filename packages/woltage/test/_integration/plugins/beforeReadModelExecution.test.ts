import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import {mockReadModel} from '../../_mock/ReadModelMock.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('beforeReadModelExecution hook', async () => {
    await it('can modify read model values before handler execution', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeReadModelExecution({query, context}) {
                return {
                    query: {
                        ...(query as Record<string, unknown>),
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
        const readModel = mockReadModel({
            test(query: unknown, context: unknown)
            {
                receivedArgs = [query, context];
            }
        });

        mockExecutionContext({
            pluginRegistry,
            context: {test: 21}
        });
        await readModel.call('test', {test: 42});

        assert.deepStrictEqual(receivedArgs, [
            {
                test: 42,
                transformed: true
            },
            {
                test: 21,
                transformed: true
            }
        ]);
    });
});
