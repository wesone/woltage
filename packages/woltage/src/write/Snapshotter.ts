import z from 'zod';
import type {StoreAdapterConfig} from '../WoltageConfig.ts';
import type {IStore} from '../adapters/Store.ts';
import type {AggregateStatus} from './Aggregate.ts';
import {STATE_NEW, STATE_EXISTS} from '../adapters/EventStore.ts';

export type SnapshotConfig = {
    /**
     * The store adapter used to store snapshots.
     * If no store was provided, the internal store will be used.
     */
    store?: StoreAdapterConfig | false,
    /**
     * Create a snapshot every `<eventCount>` events.
     * E.g. every 100 events.
     */
    eventCount?: number | false,
    /**
     * Create a snapshot as soon as the duration in milliseconds to build the state, exceeds `<duration>`.
     * E.g. when loading takes longer than 500 ms.
     */
    duration?: number | false
}

export const snapshotSchema = {
    snapshots: {
        key: z.object({
            aggregateId: z.string()
        }),
        schema: z.object({
            projectorVersion: z.number(),
            aggregateType: z.string(),
            aggregateVersion: z.int(),
            revision: z.union([z.bigint(), z.literal([STATE_NEW, STATE_EXISTS])]),
            timestamp: z.int(),
            state: z.any()
        })
    }
};

class Snapshotter
{
    #aggregateType: string;
    config?: SnapshotConfig | false;
    #store?: IStore<typeof snapshotSchema>;

    constructor(aggregateType: string) {
        this.#aggregateType = aggregateType;
    }

    async setStore(store: IStore | undefined) {
        if(store)
        {
            store.defineTables(snapshotSchema);
            await store.connect();
        }
        this.#store = store;
    }

    /**
     * Configs are applied from left to right, where the rightmost config has the highest priority.
     */
    configure(...configs: (SnapshotConfig | false | undefined)[]) {
        let config = configs.shift();
        while(configs.length)
        {
            const nextConfig = configs.shift();
            config = (
                !config && !nextConfig
                || nextConfig === false
            )
                ? false
                : {
                    ...(config || {}),
                    ...(nextConfig || {})
                };
        }
        return this.config = config;
    }

    async set(snapshot: Parameters<IStore<typeof snapshotSchema>['tables']['snapshots']['set']>[0]) {
        await this.#store?.tables.snapshots.set(snapshot);
    }

    async get(aggregateId: string) {
        return await this.#store?.tables.snapshots.get({aggregateId}) ?? null;
    }

    async remove(aggregateId: string) {
        await this.#store?.tables.snapshots.remove({aggregateId});
    }

    async beginSession(aggregateId: string) {
        if(!this.config)
            return {
                snapshot: null,
                endSession: () => Promise.resolve()
            };

        const config = this.config;
        const snapshot = await this.get(aggregateId);
        const startTime = performance.now();
        return {
            snapshot,
            endSession: async (status: AggregateStatus) => {
                if(
                    config.duration && (performance.now() - startTime) > config.duration
                    || config.eventCount && status.aggregateVersion % config.eventCount === 0
                )
                    await this.set({
                        aggregateId,
                        projectorVersion: status.projectorVersion,
                        aggregateType: this.#aggregateType,
                        aggregateVersion: status.aggregateVersion,
                        revision: status.revision,
                        timestamp: Date.now(),
                        state: status.state
                    });
            }
        };
    }
}

export default Snapshotter;
