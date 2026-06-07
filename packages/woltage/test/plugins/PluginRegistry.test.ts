import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';

import PluginRegistry, {type HookData, type HookName, type ErrorHookName} from '../../src/plugins/PluginRegistry.ts';
import mockPlugin, {mockPluginRegistry} from '../_mock/mockPlugin.ts';
import mockEventClass from '../_mock/mockEventClass.ts';
import {mockReadModel} from '../_mock/ReadModelMock.ts';
import mockConsole from '../_mock/mockConsole.ts';

await describe('PluginRegistry', async () => {
    const forcedError = new Error('Break');
    const testGenerals = async <T extends HookName>(hookName: T, data: HookData<T>) => {
        await it('can force throw an error by providing an `error`', async () => {
            const registry = mockPluginRegistry({
                [hookName]: () => ({
                    error: forcedError
                })
            }, {errorStrategy: 'ignore'});

            await assert.rejects(
                registry[hookName]({...(data as any)}),
                forcedError
            );
        });

        await it('can stop calling subsequent plugins by providing `breakChain: true`', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => {}
                },
                {
                    [hookName]: () => ({
                        error: forcedError
                    })
                }
            ]);
            const registry2 = mockPluginRegistry([
                {
                    [hookName]: () => ({
                        breakChain: true
                    })
                },
                {
                    [hookName]: () => ({
                        error: forcedError
                    })
                }
            ]);

            await assert.rejects(
                registry[hookName]({...(data as any)}),
                forcedError
            );
            await assert.doesNotReject(registry2[hookName]({...(data as any)}));
        });
    };
    const testErrorGenerals = async <T extends ErrorHookName>(hookName: T, data: HookData<T>) => {
        const originalError = data.error;

        await it('can suppress errors', async () => {
            const registry = mockPluginRegistry({
                [hookName]: () => ({suppress: true})
            });

            await assert.doesNotReject(registry.handleError(hookName, {...data}));
        });

        await it('throws original error', async () => {
            const registry = mockPluginRegistry({
                [hookName]: () => ({suppress: false})
            });

            await assert.rejects(
                registry.handleError(hookName, {...data}),
                originalError
            );

            const registry2 = mockPluginRegistry({
                [hookName]: () => {}
            });

            await assert.rejects(
                registry2.handleError(hookName, {...data}),
                originalError
            );
        });

        await it('can modify thrown error by providing an `error`', async () => {
            const registry = mockPluginRegistry({
                [hookName]: () => ({
                    error: forcedError
                })
            }, {errorStrategy: 'ignore'});

            await assert.rejects(
                registry[hookName]({...(data as any)}),
                forcedError
            );
        });

        await it('can stop calling subsequent plugins by providing `breakChain: true`', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => {}
                },
                {
                    [hookName]: () => ({
                        error: forcedError
                    })
                }
            ]);
            const registry2 = mockPluginRegistry([
                {
                    [hookName]: () => ({
                        breakChain: true
                    })
                },
                {
                    [hookName]: () => ({
                        error: forcedError
                    })
                }
            ]);

            await assert.rejects(
                registry[hookName]({...(data as any)}),
                forcedError
            );
            await assert.rejects(
                registry2[hookName]({...(data as any)}),
                originalError
            );
        });
    };

    it('can be constructed', () => {
        assert.doesNotThrow(() => new PluginRegistry([
            {
                handle: 'plugin-1'
            },
            mockPlugin({
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
                mockPlugin({
                    hooks: {
                        beforeCommandValidation: () => ({
                            payload: {injected: true}
                        }),
                        afterCommandExecution: () => ({
                            stateUpdate: []
                        })
                    }
                }),
                mockPlugin({
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
            payload: Object.freeze({p: 1})
        };

        await it('can transform payload', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: data => ({
                        payload: {
                            ...(data.payload as any),
                            change1: true
                        }
                    })
                },
                {
                    [hookName]: data => ({
                        payload: {
                            ...(data.payload as any),
                            change2: true
                        }
                    })
                }
            ]);

            const result = await registry[hookName]({...data});

            assert.deepStrictEqual(
                result,
                {skip: false, payload: {p: 1, change1: true, change2: true}}
            );
        });

        await it('can skip validation', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => ({
                        skip: true
                    })
                },
                {
                    [hookName]: () => {}
                }
            ]);

            const result = await registry[hookName]({...data});

            assert.deepStrictEqual(result, {skip: true, payload: {p: 1}});
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandValidationError', async () => {
        const hookName = 'onCommandValidationError';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
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
            const registry = mockPluginRegistry([
                {
                    [hookName]: data => ({
                        payload: {
                            ...(data.payload as any),
                            changed: true
                        },
                        state: {
                            ...(data.state as any),
                            change1: true
                        }
                    })
                },
                {
                    [hookName]: data => ({
                        state: {
                            ...(data.state as any),
                            change2: true
                        },
                        context:{
                            ...(data.context as any),
                            changed: true
                        }
                    })
                }
            ]);

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {
                payload: {p: 1, changed: true},
                state: {s: 1, change1: true, change2: true},
                context: {aggregateId: 'a1', aggregateVersion: 42, changed: true}
            });
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandExecutionError', async () => {
        const hookName = 'onCommandExecutionError';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            state: {s: 1},
            context: {aggregateId: 'a1', aggregateVersion: 42},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
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
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => {}
                },
                {
                    [hookName]: () => ({
                        stateUpdate: []
                    })
                }
            ]);

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, []);
        });

        await testGenerals(hookName, data);
    });

    await describe('onCommandError', async () => {
        const hookName = 'onCommandError';
        const data = {
            commandInfo: {} as any,
            aggregateId: 'a',
            payload: {p: 1},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
    });

    await describe('beforeReadModelValidation', async () => {
        const hookName = 'beforeReadModelValidation';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1}
        };

        await it('can transform query', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: data => ({
                        query: {
                            ...(data.query as any),
                            change1: true
                        }
                    })
                },
                {
                    [hookName]: data => ({
                        query: {
                            ...(data.query as any),
                            change2: true
                        }
                    })
                }
            ]);

            const result = await registry[hookName]({...data});

            assert.deepStrictEqual(result, {skip: false, query: {q: 1, change1: true, change2: true}});
        });

        await it('can skip validation', async () => {
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => ({
                        skip: true
                    })
                },
                {
                    [hookName]: () => {}
                }
            ]);

            const result = await registry[hookName]({...data});

            assert.deepStrictEqual(result, {skip: true, query: {q: 1}});
        });

        await testGenerals(hookName, data);
    });

    await describe('onReadModelValidationError', async () => {
        const hookName = 'onReadModelValidationError';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
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
            const registry = mockPluginRegistry([
                {
                    [hookName]: data => ({
                        query: {
                            ...(data.query as any),
                            changed: true
                        }
                    })
                },
                {
                    [hookName]: data => ({
                        context: {
                            ...(data.context as any),
                            changed: true
                        }
                    })
                }
            ]);

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
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
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
            const registry = mockPluginRegistry([
                {
                    [hookName]: () => ({
                        result: {manipulation1: true}
                    })
                },
                {
                    [hookName]: ({result}) => ({
                        result: {...(result as any), manipulation2: true}
                    })
                }
            ]);

            const result = await registry[hookName](data);

            assert.deepStrictEqual(result, {manipulation1: true, manipulation2: true});
        });

        await testGenerals(hookName, data);
    });

    await describe('onReadModelError', async () => {
        const hookName = 'onReadModelError';
        const data = {
            readModel: await mockReadModel(),
            handlerName: '',
            query: {q: 1},
            context: {},
            error: new Error('Original')
        };

        await testErrorGenerals(hookName, data);
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

        const registry = mockPluginRegistry(
            {[hookName]: hook},
            {errorStrategy: 'ignore'}
        );

        await assert.rejects(registry.handleError(hookName, data));
        assert.strictEqual(hook.mock.callCount(), 0);
    });

    await describe('errorStrategy', async () => {
        await it('`throw` propagates plugin errors', async () => {
            const unexpectedError = new Error('Book');
            const registry = mockPluginRegistry({
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
            const registry = mockPluginRegistry({
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
                const registry = mockPluginRegistry(hooks, {
                    name: pluginName,
                    errorStrategy: 'log'
                });

                const {consoleCalls, resetConsoleMock} = mockConsole('error');

                try
                {
                    await assert.doesNotReject(
                        registry.beforeCommandValidation({
                            commandInfo: {} as any,
                            aggregateId: 'a',
                            payload: {p: 1}
                        })
                    );

                    assert.equal(consoleCalls.length, 1);
                    assert.deepStrictEqual(consoleCalls[0], [`Plugin ${pluginName} error in 'beforeCommandValidation':`, unexpectedError]);
                }
                finally
                {
                    resetConsoleMock();
                }
            });

            await it('using the plugin\'s handle (as fallback)', async () => {
                const registry = mockPluginRegistry(hooks, {
                    handle: pluginHandle,
                    name: undefined,
                    errorStrategy: 'log'
                });

                const {consoleCalls, resetConsoleMock} = mockConsole('error');

                try
                {
                    await assert.doesNotReject(
                        registry.beforeCommandValidation({
                            commandInfo: {} as any,
                            aggregateId: 'a',
                            payload: {p: 1}
                        })
                    );

                    assert.equal(consoleCalls.length, 1);
                    assert.deepStrictEqual(consoleCalls[0], [`Plugin ${pluginHandle} error in 'beforeCommandValidation':`, unexpectedError]);
                }
                finally
                {
                    resetConsoleMock();
                }
            });
        });

        await it('uses `log` as default', async () => {
            const unexpectedError = new Error('Book');
            const registry = mockPluginRegistry({
                beforeCommandValidation: () => {
                    throw unexpectedError;
                }
            }, {errorStrategy: undefined});

            const {consoleCalls, resetConsoleMock} = mockConsole('error');

            try
            {
                await assert.doesNotReject(
                    registry.beforeCommandValidation({
                        commandInfo: {} as any,
                        aggregateId: 'a',
                        payload: {p: 1}
                    })
                );
                assert.equal(consoleCalls.length, 1);
            }
            finally
            {
                resetConsoleMock();
            }
        });
    });
});
