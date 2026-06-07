import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';
import z from 'zod';
import {mockReadModel} from '../../_mock/ReadModelMock.ts';

await describe('beforeReadModelValidation hook', async () => {
    await it('can modify read model query before validation', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeReadModelValidation({query}) {
                const {str} = query as {str: number};
                return {
                    query: {
                        str: str.toString()
                    }
                };
            }
        });

        let receivedQuery: unknown;
        const readModel = await mockReadModel({
            test(query)
            {
                receivedQuery = query;
            }
        }, {
            test: z.object({
                str: z.string()
            })
        });

        mockExecutionContext({
            pluginRegistry
        });
        await readModel.call('test', {str: 42});

        assert.deepStrictEqual(receivedQuery, {str: '42'});
    });

    await it('can skip read model validation', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeReadModelValidation() {
                return {
                    skip: true
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

        const commandArgs = ['test', {unknown: 42}] as const;

        await assert.rejects(readModel.call(...commandArgs));
        assert.strictEqual(called, false);

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(readModel.call(...commandArgs));
        assert.strictEqual(called, true);
    });
});
