import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import {mockReadModel} from '../../_mock/ReadModelMock.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('afterReadModelExecution hook', async () => {
    await it('can modify read model handler\'s return value', async () => {
        const pluginRegistry = mockPluginRegistry({
            afterReadModelExecution({result}) {
                return {
                    result: {
                        ...(result as Record<string, unknown>),
                        modified: true
                    }
                };
            }
        });

        const readModel = mockReadModel({
            test()
            {
                return {test: 42};
            }
        });

        mockExecutionContext({pluginRegistry});
        const result = await readModel.call('test', {});

        assert.deepStrictEqual(
            result,
            {
                test: 42,
                modified: true
            }
        );
    });
});
