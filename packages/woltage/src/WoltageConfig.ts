import type Event from './Event.ts';
import type {IEventStore} from './adapters/EventStore.ts';
import type {IStore} from './adapters/Store.ts';
import type {IScheduler} from './adapters/Scheduler.ts';
import type Projector from './read/Projector.ts';
import type ReadModel from './read/ReadModel.ts';
import type Aggregate from './write/Aggregate.ts';
import type {SnapshotConfig} from './write/Snapshotter.ts';

export type AdapterConfig<T extends new (...args: any) => any = any> = {
    adapter: T,
    args: ConstructorParameters<T>
};
export type EventStoreAdapterConfig<T extends new (...args: any) => IEventStore = any> = AdapterConfig<T>;
export type StoreAdapterConfig<T extends new (...args: any) => IStore = any> = AdapterConfig<T>;
export type SchedulerAdapterConfig<T extends new (...args: any) => IScheduler = any> = AdapterConfig<T>;

export type WoltageConfig = {
    /**
     * An event store adapter.
     */
    eventStore: EventStoreAdapterConfig,
    /**
     * An array of event classes or a path to a directory to import event classes from.
     *
     * Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.
     */
    eventClasses: (typeof Event)[] | string,
    /**
     * An array of aggregate instances or a path to a directory to import aggregates from.
     *
     * Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.
     */
    aggregates: Aggregate[] | string,
    /**
     * An array of projector classes or a path to a directory to import projector classes from.
     *
     * Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.
     */
    projectorClasses: (typeof Projector)[] | string,
    /**
     * An array of read model classes or a path to a directory to import read model classes from.
     *
     * Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.
     */
    readModelClasses?: (typeof ReadModel)[] | string,
    /**
     * A store adapter that is used to store internal data.
     */
    internalStore: StoreAdapterConfig,
    /**
     * A list of store adapters that can be used for projections. The keys are arbitrary names for the adapters.
     */
    stores?: Record<string, StoreAdapterConfig>,
    /**
     * Set a snapshot config globally for all aggregates. If `false`, snapshots are not used.
     *
     * Default: `false`
     */
    snapshots?: SnapshotConfig | false,
    /**
     * Boolean indicating if Woltage should start automatically after creation. Use `woltage.start()` to start manually.
     *
     * Default: `true`
     */
    autostart?: boolean,
    /**
     * A custom scheduler adapter to use for scheduling commands.
     * Without a scheduler adapter, the scheduling feature is disabled.
     */
    scheduler?: SchedulerAdapterConfig

    //TODO add options for custom side effect executor
}
