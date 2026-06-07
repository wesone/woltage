import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import {mockReadModel} from '../../_mock/ReadModelMock.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';
import z from 'zod';

await describe('onReadModelValidationError hook', async () => {
    await it('can modify read model validation errors', async () => {
        const customError = new Error('Custom');
        const pluginRegistry = mockPluginRegistry({
            onReadModelValidationError() {
                return {
                    error: customError
                };
            }
        });

        let called = false;
        const readModel = await mockReadModel({
            test()
            {
                called = true;
            }
        }, {
            test: z.object({
                str: z.string()
            })
        });

        mockExecutionContext({
            pluginRegistry
        });

        await assert.rejects(
            readModel.call('test', {unknown: 42}),
            customError
        );
        assert.strictEqual(called, false);
    });

    await it('can suppress read model validation errors', async () => {
        const pluginRegistry = mockPluginRegistry({
            onReadModelValidationError() {
                return {
                    suppress: true
                };
            }
        });

        let called = false;
        const readModel = await mockReadModel({
            test()
            {
                called = true;
            }
        }, {
            test: z.object({
                str: z.string()
            })
        });

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(readModel.call('test', {unknown: 42}));
        assert.strictEqual(called, true);
    });
});
