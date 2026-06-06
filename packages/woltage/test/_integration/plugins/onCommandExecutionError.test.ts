import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('onCommandExecutionError hook', async () => {
    await it('can modify command execution errors', async () => {
        const customError = new Error('Custom');
        const pluginRegistry = mockPluginRegistry({
            onCommandExecutionError() {
                return {
                    error: customError
                };
            }
        });

        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            function test()
            {
                throw new Error('Original');
            }
        );

        mockExecutionContext({
            pluginRegistry
        });

        await assert.rejects(
            aggregate.executeCommand('a1', name, {}),
            customError
        );
    });

    await it('can suppress command execution errors', async () => {
        const pluginRegistry = mockPluginRegistry({
            onCommandExecutionError() {
                return {
                    suppress: true
                };
            }
        });

        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            function test()
            {
                throw new Error('Original');
            }
        );

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(aggregate.executeCommand('a1', name, {}));
    });
});
