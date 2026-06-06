import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import {mockReadModel} from '../../_mock/ReadModelMock.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('onReadModelExecutionError hook', async () => {
    await it('can modify read model execution errors', async () => {
        const customError = new Error('Custom');
        const pluginRegistry = mockPluginRegistry({
            onReadModelExecutionError() {
                return {
                    error: customError
                };
            }
        });

        const readModel = mockReadModel({
            test()
            {
                throw new Error('Original');
            }
        });

        mockExecutionContext({
            pluginRegistry
        });

        await assert.rejects(
            readModel.call('test', {}),
            customError
        );
    });

    await it('can suppress read model execution errors', async () => {
        const pluginRegistry = mockPluginRegistry({
            onReadModelExecutionError() {
                return {
                    suppress: true
                };
            }
        });

        const readModel = mockReadModel({
            test()
            {
                throw new Error('Original');
            }
        });

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(readModel.call('test', {}));
    });
});
