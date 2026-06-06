import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';

await describe('onCommandError hook', async () => {
    await it('can modify command errors', async () => {
        const customError = new Error('Custom');
        const pluginRegistry = mockPluginRegistry({
            onCommandError() {
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

    await it('can suppress command errors', async () => {
        const pluginRegistry = mockPluginRegistry({
            onCommandError() {
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
