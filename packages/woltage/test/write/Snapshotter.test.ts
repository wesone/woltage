import {afterEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';

import Snapshotter from '../../src/write/Snapshotter.ts';
import type {SnapshotConfig, snapshotSchema} from '../../src/write/Snapshotter.ts';
import StoreMock from '../_mock/StoreMock.ts';

describe('Snapshotter', async () => {
    const snapshot = {
        aggregateId: 'aggregateId1',
        aggregateVersion: 1,
        projectorVersion: 0,
        aggregateType: 'test',
        revision: 1n,
        timestamp: new Date(),
        state: {}
    };

    describe('configure', async () => {
        const StoreA = {adapter: StoreMock, args: ['storeA']};
        const StoreB = {adapter: StoreMock, args: ['storeB']};

        await it('handles a single config', async () => {
            const snapshotter = new Snapshotter('test');
            const config = {eventCount: 100};
            assert.deepStrictEqual(snapshotter.configure(config), config);
            assert.deepStrictEqual(snapshotter.configure(), undefined);
        });

        await it('merges configs', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = {store: StoreA, duration: 1000};
            const config2 = {eventCount: 100};
            const expectedConfig = {store: StoreA, duration: 1000, eventCount: 100};
            assert.deepStrictEqual(snapshotter.configure(config1, config2), expectedConfig);
        });

        await it('overwrites left values with right values', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = {store: StoreA, eventCount: 100, duration: 500};
            const config2 = {store: StoreB, eventCount: 42};
            const expectedConfig = {store: StoreB, eventCount: 42, duration: 500};
            assert.deepStrictEqual(snapshotter.configure(config1, config2), expectedConfig);
        });

        await it('resets values if `false` was set', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = {store: StoreA, eventCount: 100};
            const config2 = {store: false, eventCount: false, duration: 500} as SnapshotConfig;
            const config3 = {store: StoreB, duration: 500};
            const expectedConfig = {store: StoreB, eventCount: false, duration: 500};
            assert.deepStrictEqual(snapshotter.configure(config1, config2, config3), expectedConfig);
        });

        await it('has a config if base config is false but second config exists', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = false;
            const config2 = {eventCount: 100};
            const expectedConfig = {eventCount: 100};
            assert.deepStrictEqual(snapshotter.configure(config1, config2), expectedConfig);
        });

        await it('disables a base config if second config is false', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = {eventCount: 100};
            const config2 = false;
            const expectedConfig = false;
            assert.deepStrictEqual(snapshotter.configure(config1, config2), expectedConfig);
        });

        await it('keeps base config if second config is undefined', async () => {
            const snapshotter = new Snapshotter('test');
            const config1 = {eventCount: 100};
            const config2 = undefined;
            const expectedConfig = {eventCount: 100};
            assert.deepStrictEqual(snapshotter.configure(config1, config2), expectedConfig);
        });
    });

    describe('setStore', async () => {
        await it('defines tables and connects if store was provided', async () => {
            const snapshotter = new Snapshotter('test');
            const storeMock = new StoreMock();
            await snapshotter.setStore(storeMock);

            assert.strictEqual(storeMock.defineTables.mock.callCount(), 1);
            assert.strictEqual(storeMock.connect.mock.callCount(), 1);
        });

        await it('overrides an existing store if undefined was provided', async () => {
            const snapshotter = new Snapshotter('test');
            const storeMock = new StoreMock<typeof snapshotSchema>();

            await snapshotter.setStore(storeMock);
            await snapshotter.get('aggregateId1');

            await snapshotter.setStore(undefined);
            await snapshotter.get('aggregateId1');
            assert.strictEqual(storeMock.tables.snapshots.get.mock.callCount(), 1);
        });
    });

    await it('set - creates a new snapshot in its store', async () => {
        const snapshotter = new Snapshotter('test');
        const storeMock = new StoreMock<typeof snapshotSchema>();
        await snapshotter.set(snapshot);
        await snapshotter.setStore(storeMock);
        await snapshotter.set(snapshot);

        assert.deepStrictEqual(storeMock.tables.snapshots.records['{"aggregateId":"aggregateId1"}'], snapshot);
    });

    await it('get - returns existing snapshot or null', async () => {
        const snapshotter = new Snapshotter('test');
        const storeMock = new StoreMock<typeof snapshotSchema>();

        assert.strictEqual(await snapshotter.get(snapshot.aggregateId), null);

        await snapshotter.setStore(storeMock);
        await snapshotter.set(snapshot);
        assert.strictEqual(await snapshotter.get(snapshot.aggregateId), snapshot);
        assert.strictEqual(await snapshotter.get('unknown'), null);
    });

    await it('remove - removes snapshot if exists', async () => {
        const snapshotter = new Snapshotter('test');
        const storeMock = new StoreMock();
        await assert.doesNotReject(() => snapshotter.remove(snapshot.aggregateId));

        await snapshotter.setStore(storeMock);
        await snapshotter.set(snapshot);
        assert.strictEqual(await snapshotter.get(snapshot.aggregateId), snapshot);

        await assert.doesNotReject(() => snapshotter.remove(snapshot.aggregateId));
        assert.strictEqual(await snapshotter.get(snapshot.aggregateId), null);
    });

    describe('hydrateStatus', async () => {
        const snapshotter = new Snapshotter('test');
        const storeMock = new StoreMock();
        await snapshotter.setStore(storeMock);
        const exampleStatus = {
            aggregateId: snapshot.aggregateId,
            aggregateVersion: 0,
            projectorVersion: 0,
            state: {},
            revision: 1n
        };

        afterEach(() => {
            // snapshotter.configure(false);
            storeMock.clear();
        });

        await it('does not load existing snapshots without config', async () => {
            const snapshotter = new Snapshotter('test');
            await snapshotter.hydrateStatus(exampleStatus, async s => s);

            assert.strictEqual(storeMock.tables.snapshots.get.mock.callCount(), 0);
        });

        await it('uses existing snapshots', async () => {
            await snapshotter.set(snapshot);
            snapshotter.configure({eventCount: 100});

            const {postHydrationPromise, ...status} = await snapshotter.hydrateStatus(exampleStatus, async s => s);
            await postHydrationPromise;

            assert.strictEqual(status.aggregateVersion, snapshot.aggregateVersion);
        });

        describe('hydration', async () => {
            const internalStoreKey = '{"aggregateId":"aggregateId1"}';

            await it('does not add a new snapshot if no condition was met', async () => {
                snapshotter.configure({eventCount: 100, duration: 1000});

                const {postHydrationPromise} = await snapshotter.hydrateStatus(exampleStatus, async s => ({
                    ...s,
                    aggregateVersion: 99
                }));
                await postHydrationPromise;

                assert.equal(Object.values(storeMock.tables.snapshots.records).length, 0);
            });

            await it('adds a new snapshot if eventCount condition was met', async () => {
                snapshotter.configure({eventCount: 100, duration: false});
                {
                    const {postHydrationPromise} = await snapshotter.hydrateStatus(exampleStatus, async s => ({
                        ...s,
                        aggregateVersion: 100
                    }));
                    await postHydrationPromise;

                    assert.deepStrictEqual(storeMock.tables.snapshots.records, {
                        [internalStoreKey]: {
                            ...snapshot,
                            aggregateVersion: 100,
                            timestamp: storeMock.tables.snapshots.records[internalStoreKey].timestamp
                        }
                    });
                }
                {
                    const {postHydrationPromise} = await snapshotter.hydrateStatus(exampleStatus, async s => ({
                        ...s,
                        aggregateVersion: 200
                    }));
                    await postHydrationPromise;

                    assert.deepStrictEqual(storeMock.tables.snapshots.records, {
                        [internalStoreKey]: {
                            ...snapshot,
                            aggregateVersion: 200,
                            timestamp: storeMock.tables.snapshots.records[internalStoreKey].timestamp
                        }
                    });
                }
            });

            await it('adds a new snapshot if duration condition was met', async () => {
                snapshotter.configure({duration: 20, eventCount: false});
                {
                    const {postHydrationPromise} = await snapshotter.hydrateStatus(exampleStatus, async s => s);
                    await postHydrationPromise;

                    assert.equal(Object.values(storeMock.tables.snapshots.records).length, 0);
                }
                {
                    const {postHydrationPromise} = await snapshotter.hydrateStatus(exampleStatus, async s => {
                        await new Promise(r => setTimeout(r, 25));
                        return {
                            ...s,
                            aggregateVersion: snapshot.aggregateVersion
                        };
                    });
                    await postHydrationPromise;

                    assert.deepStrictEqual(storeMock.tables.snapshots.records, {
                        [internalStoreKey]: {
                            ...snapshot,
                            timestamp: storeMock.tables.snapshots.records[internalStoreKey].timestamp
                        }
                    });
                }
            });

            await it('skips existing snapshot if snapshot has an outdated aggregate projector version', async () => {
                await snapshotter.set(snapshot);
                snapshotter.configure({eventCount: 100});

                const {postHydrationPromise, ...status} = await snapshotter.hydrateStatus(
                    {...exampleStatus, projectorVersion: 1},
                    async s => s
                );
                await postHydrationPromise;

                assert.notDeepStrictEqual(status.aggregateVersion, snapshot.aggregateVersion);
            });

            await it('retries to build state from scratch if existing snapshot is corrupt and not compatible with current aggregate projector anymore', async () => {
                await snapshotter.set(snapshot);
                snapshotter.configure({eventCount: 100});

                const {postHydrationPromise, ...status} = await snapshotter.hydrateStatus(
                    exampleStatus,
                    async s => {
                        if(s.aggregateVersion === 1) // snapshot was used
                            throw new Error('Corrupt Snapshot');
                        return s;
                    }
                );
                await postHydrationPromise;

                assert.notDeepStrictEqual(status.aggregateVersion, snapshot.aggregateVersion);
                assert.deepStrictEqual(status.aggregateVersion, exampleStatus.aggregateVersion);
            });
        });
    });
});
