import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';
import z from 'zod';

await describe('onCommandValidationError hook', async () => {
    await it('can modify command validation errors', async () => {
        const customError = new Error('Custom');
        const pluginRegistry = mockPluginRegistry({
            onCommandValidationError() {
                return {
                    error: customError
                };
            }
        });

        let called = false;
        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            z.object({
                str: z.string()
            }),
            function test()
            {
                called = true;
            }
        );

        mockExecutionContext({
            pluginRegistry
        });

        await assert.rejects(
            aggregate.executeCommand('a1', name, {unknown: 42}),
            customError
        );
        assert.strictEqual(called, false);
    });

    await it('can suppress command validation errors', async () => {
        const pluginRegistry = mockPluginRegistry({
            onCommandValidationError() {
                return {
                    suppress: true
                };
            }
        });

        let called = false;
        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            z.object({
                str: z.string()
            }),
            function test()
            {
                called = true;
            }
        );

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(aggregate.executeCommand('a1', name, {unknown: 42}));
        assert.strictEqual(called, true);
    });
});
