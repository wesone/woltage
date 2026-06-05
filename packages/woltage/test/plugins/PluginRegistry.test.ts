import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import PluginRegistry, {type Hooks, type HookData, type HookName, type Plugin} from '../../src/plugins/PluginRegistry.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import {mockReadModel} from '../_mock/ReadModelMock.ts';
import mockConsole from '../_mock/mockConsole.ts';

function createPlugin(overrides: Partial<Plugin> = {})
{
    return {
        handle: 'plugin-' + Math.random().toString(16).slice(2),
        name: 'TestPlugin',
        errorStrategy: 'ignore',
        hooks: {},
        ...overrides
    } satisfies Plugin;
}

function createPluginRegistry(hooks: Partial<Hooks>, overrides: Partial<Omit<Plugin, 'hooks'>> = {})
{
    return new PluginRegistry([
        createPlugin({
            ...overrides,
            hooks
        })
    ]);
}

await describe('PluginRegistry', async () => {
    const expectedError = new Error('Break');
    const testGenerals = async <T extends HookName>(hookName: T, data: HookData<T>) => {
        await it('can force throw an error by providing an `error`', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({
                    error: expectedError
                })
            }, {errorStrategy: 'ignore'});

            await assert.rejects(
                registry[hookName](data as any),
                expectedError
            );
        });

        await it('can stop calling subsequent plugins by providing `breakChain: true`', async () => {
            const registry = new PluginRegistry([
                createPlugin({
                    hooks: {
                        [hookName]: () => ({})
                    }
                }),
                createPlugin({
                    hooks: {
                        [hookName]: () => ({
                            error: expectedError
                        })
                    }
                })
            ]);

            await assert.rejects(
                registry[hookName](data as any),
                expectedError
            );

            const registry2 = new PluginRegistry([
                createPlugin({
                    hooks: {
                        [hookName]: () => ({
                            breakChain: true
                        })
                    }
                }),
                createPlugin({
                    hooks: {
                        [hookName]: () => ({
                            error: expectedError
                        })
                    }
                })
            ]);

            await assert.doesNotReject(registry2[hookName](data as any));
        });
    };

    it('can be constructed', () => {
        assert.doesNotThrow(() => new PluginRegistry([
            {
                handle: 'plugin-1'
            },
            createPlugin({
                handle: 'plugin-2',
                hooks: {
                    beforeCommandValidation: () => ({
                        payload: {injected: true}
                    })
                }
            })
        ]));
    });

    await describe('constructor', async () => {
        it('checks for invalid plugin handles', () => {
            assert.throws(() => new PluginRegistry([
                {handle: ''}
            ]));
            assert.throws(() => new PluginRegistry([
            /** @ts-expect-error wrong type */
                {handle: 42}
            ]));
            assert.throws(() => new PluginRegistry([
            /** @ts-expect-error wrong type */
                {}
            ]));
        });

        it('checks for unique plugin handles', () => {
            assert.throws(() => new PluginRegistry([
                {handle: 'plugin-1'},
                {handle: 'plugin-2'},
                {handle: 'plugin-1'}
            ]));
        });

        it('registers hooks', () => {
            const registry = new PluginRegistry([
                createPlugin({
                    hooks: {
                        beforeCommandValidation: () => ({
                            payload: {injected: true}
                        }),
                        afterCommandExecution: () => ({
                            stateUpdate: []
                        })
                    }
                }),
                createPlugin({
                    hooks: {
                        onCommandValidationError: () => ({
                            suppress: true
                        })
                    }
                })
            ]);

            assert.strictEqual(registry.hasHook('beforeCommandValidation'), true);
            assert.strictEqual(registry.hasHook('afterCommandExecution'), true);
            assert.strictEqual(registry.hasHook('onCommandValidationError'), true);
            assert.strictEqual(registry.hasHook('onCommandError'), false);
        });
    });

    await describe('beforeCommandValidation', async () => {
        const hookName = 'beforeCommandValidation';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1}
        };

        await it('can transform payload', async () => {
            const registry = createPluginRegistry({
                [hookName]: data => ({
                    payload: {
                        ...(data.payload as any),
                        changed: true
                    }
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {p: 1, changed: true});
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandValidationError', async () => {
        const hookName = 'onCommandValidationError';
        const originalError = new Error('Original');
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await describe('beforeCommandExecution ', async () => {
        const hookName = 'beforeCommandExecution';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            state: {s: 1},
            context: {aggregateId: 'a1', aggregateVersion: 42}
        };

        await it('can transform values', async () => {
            const registry = createPluginRegistry({
                [hookName]: data => ({
                    payload: {
                        ...(data.payload as any),
                        changed: true
                    },
                    state: {
                        ...(data.state as any),
                        changed: true
                    },
                    context:{
                        ...(data.context as any),
                        changed: true
                    }
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {
                payload: {p: 1, changed: true},
                state: {s: 1, changed: true},
                context: {aggregateId: 'a1', aggregateVersion: 42, changed: true}
            });
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandExecutionError', async () => {
        const hookName = 'onCommandExecutionError';
        const originalError = new Error('Original');
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            state: {s: 1},
            context: {aggregateId: 'a1', aggregateVersion: 42},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await describe('afterCommandExecution', async () => {
        const hookName = 'afterCommandExecution';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            state: {s: 1},
            context: {aggregateId: 'a1', aggregateVersion: 42},
            stateUpdate: [new (mockEventClass('test-event'))({payload: {}})]
        };

        await it('can transform stateUpdate', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({
                    stateUpdate: []
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, []);
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandError', async () => {
        const hookName = 'onCommandError';
        const originalError = new Error('Original');
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await describe('beforeReadModelValidation', async () => {
        const hookName = 'beforeReadModelValidation';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1}
        };

        await it('can transform query', async () => {
            const registry = createPluginRegistry({
                [hookName]: data => ({
                    query: {
                        ...(data.query as any),
                        changed: true
                    }
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {q: 1, changed: true});
        });

        await testGenerals(hookName, data);
    });

    await describe('onReadModelValidationError', async () => {
        const hookName = 'onReadModelValidationError';
        const originalError = new Error('Original');
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await it('beforeReadModelExecution', async () => {
        const hookName = 'beforeReadModelExecution';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {c: 1}
        };

        await it('can transform values', async () => {
            const registry = createPluginRegistry({
                [hookName]: data => ({
                    query: {
                        ...(data.query as any),
                        changed: true
                    },
                    context: {
                        ...(data.context as any),
                        changed: true
                    }
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {
                query: {q: 1, changed: true},
                context: {c: 1, changed: true}
            });
        });

        await testGenerals(hookName, data);
    });

    await describe('onReadModelExecutionError', async () => {
        const hookName = 'onReadModelExecutionError';
        const originalError = new Error('Original');
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await it('afterReadModelExecution', async () => {
        const hookName = 'afterReadModelExecution';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {c: 1},
            result: {original: true}
        };

        await it('can transform handler\'s return value', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({
                    result: {manipulated: true}
                })
            });

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {manipulated: true});
        });

        await testGenerals(hookName, data);
    });

    await describe('onReadModelError', async () => {
        const hookName = 'onReadModelError';
        const originalError = new Error('Original');
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {},
            error: originalError
        };

        await it('can suppress errors', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, data));
        });

        await it('throws original error', async () => {
            const registry = createPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, data),
                originalError
            );

            const registry2 = createPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, data),
                originalError
            );
        });

        await testGenerals(hookName, data);
    });

    await it('handleError rethrows non-error values regardless of errorStrategy', async () => {
        const hookName = 'onCommandError';
        const hook = mock.fn();
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            error: 42
        };

        const registry = createPluginRegistry(
            {[hookName]: hook},
            {errorStrategy: 'ignore'}
        );

        await assert.rejects(registry.handleError(hookName, data));
        assert.strictEqual(hook.mock.callCount(), 0);
    });

    await describe('errorStrategy', async () => {
        await it('`throw` propagates plugin errors', async () => {
            const unexpectedError = new Error('Book');
            const registry = createPluginRegistry({
                beforeCommandValidation: () => {
                    throw unexpectedError;
                }
            }, {errorStrategy: 'throw'});

            await assert.rejects(
                registry.beforeCommandValidation({
                    commandInfo: {} as any,
                    aggregateId: 'a',
                    payload: {p: 1}
                }),
                unexpectedError
            );
        });

        await it('`ignore` suppresses plugin errors', async () => {
            const unexpectedError = new Error('Book');
            const registry = createPluginRegistry({
                beforeCommandValidation: () => {
                    throw unexpectedError;
                }
            }, {errorStrategy: 'ignore'});

            await assert.doesNotReject(
                registry.beforeCommandValidation({
                    commandInfo: {} as any,
                    aggregateId: 'a',
                    payload: {p: 1}
                })
            );
        });

        await describe('`log` logs plugin errors with `console.error`', async () => {
            const pluginHandle = 'test-plugin';
            const pluginName = 'Test Plugin';
            const unexpectedError = new Error('Book');
            const hooks = {
                beforeCommandValidation: () => {
                    throw unexpectedError;
                }
            };

            await it('using the plugin\'s name', async () => {
                const registry = createPluginRegistry(hooks, {
                    name: pluginName,
                    errorStrategy: 'log'
                });

                const {calls, reset} = mockConsole('error');

                try
                {
                    await assert.doesNotReject(
                        registry.beforeCommandValidation({
                            commandInfo: {} as any,
                            aggregateId: 'a',
                            payload: {p: 1}
                        })
                    );

                    assert.equal(calls.length, 1);
                    assert.deepEqual(calls[0], [`Plugin ${pluginName} error in 'beforeCommandValidation':`, unexpectedError]);
                }
                finally
                {
                    reset();
                }
            });

            await it('using the plugin\'s handle (as fallback)', async () => {
                const registry = createPluginRegistry(hooks, {
                    handle: pluginHandle,
                    name: undefined,
                    errorStrategy: 'log'
                });

                const {calls, reset} = mockConsole('error');

                try
                {
                    await assert.doesNotReject(
                        registry.beforeCommandValidation({
                            commandInfo: {} as any,
                            aggregateId: 'a',
                            payload: {p: 1}
                        })
                    );

                    assert.equal(calls.length, 1);
                    assert.deepEqual(calls[0], [`Plugin ${pluginHandle} error in 'beforeCommandValidation':`, unexpectedError]);
                }
                finally
                {
                    reset();
                }
            });
        });

        await it('uses `log` as default', async () => {
            const unexpectedError = new Error('Book');
            const registry = createPluginRegistry({
                beforeCommandValidation: () => {
                    throw unexpectedError;
                }
            }, {errorStrategy: undefined});

            const {calls, reset} = mockConsole('error');

            try
            {
                await assert.doesNotReject(
                    registry.beforeCommandValidation({
                        commandInfo: {} as any,
                        aggregateId: 'a',
                        payload: {p: 1}
                    })
                );
                assert.equal(calls.length, 1);
            }
            finally
            {
                reset();
            }
        });
    });
});
