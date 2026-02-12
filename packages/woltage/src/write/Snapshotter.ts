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
            aggregateType: z.string(),
            aggregateVersion: z.int(),
            projectorVersion: z.number(),
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

    async hydrateStatus<TState = any>(
        initialStatus: AggregateStatus<TState>,
        hydrator: (status :AggregateStatus<TState>) => Promise<AggregateStatus<TState>>
    ) {
        const status = {...initialStatus};

        let snapshotUsed = false;
        if(this.config)
        {
            const snapshot = await this.get(status.aggregateId);
            if(snapshotUsed = snapshot?.projectorVersion === status.projectorVersion)
            {
                status.state = snapshot.state;
                status.revision = snapshot.revision;
                status.aggregateVersion = snapshot.aggregateVersion;
            }
        }

        const startTime = performance.now();
        let hydratedStatus;
        try
        {
            hydratedStatus = await hydrator(status);
        }
        catch(error)
        {
            if(!snapshotUsed)
                throw error;

            hydratedStatus = await hydrator(initialStatus);
            console.info(`Corrupt snapshot for ${this.#aggregateType} aggregate with aggregateId '${initialStatus.aggregateId}' detected. State was hydrated from scratch.`);
        }

        const postHydrationPromise = this.config && (
            this.config.duration && (performance.now() - startTime) > this.config.duration
            || this.config.eventCount && hydratedStatus.aggregateVersion % this.config.eventCount === 0
        )
            ? this.set({
                ...hydratedStatus,
                aggregateType: this.#aggregateType,
                timestamp: Date.now(),
            })
            : Promise.resolve();

        return {
            ...hydratedStatus,
            postHydrationPromise
        };
    }
}

export default Snapshotter;
