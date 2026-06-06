import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {mockPluginRegistry} from '../../_mock/mockPlugin.ts';
import Aggregate from '../../../src/write/Aggregate.ts';
import mockExecutionContext from '../../_mock/mockExecutionContext.ts';
import z from 'zod';

await describe('beforeCommandValidation hook', async () => {
    await it('can modify command payload before validation', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeCommandValidation({payload}) {
                const {str} = payload as {str: number};
                return {
                    payload: {
                        str: str.toString()
                    }
                };
            }
        });

        let receivedPayload: unknown;
        const aggregate = Aggregate.create('test-hook', {});
        const {name} = aggregate.registerCommand(
            z.object({
                str: z.string()
            }),
            function test(state, payload)
            {
                receivedPayload = payload;
            }
        );

        mockExecutionContext({
            pluginRegistry
        });
        await aggregate.executeCommand('a1', name, {str: 42});

        assert.deepStrictEqual(receivedPayload, {str: '42'});
    });

    await it('can skip command validation', async () => {
        const pluginRegistry = mockPluginRegistry({
            beforeCommandValidation() {
                return {
                    skip: true
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

        const commandArgs = ['a1', name, {unknown: 42}] as const;

        await assert.rejects(aggregate.executeCommand(...commandArgs));
        assert.strictEqual(called, false);

        mockExecutionContext({
            pluginRegistry
        });

        await assert.doesNotReject(aggregate.executeCommand(...commandArgs));
        assert.strictEqual(called, true);
    });
});
