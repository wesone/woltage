import {IEventStore} from './adapters/EventStore.ts';
import {IStore} from './adapters/Store.ts';
import Projector from './read/Projector.ts';
import ReadModel from './read/ReadModel.ts';
import Aggregate from './write/Aggregate.ts';

export type EventStoreAdapterConfig<TClass extends IEventStore = IEventStore, TArgs extends any[] = any> = {
    adapter: {new (...args: TArgs[]): TClass},
    args?: TArgs
}

export type StoreAdapterConfig<TClass extends IStore = IStore, TArgs extends any[] = any> = {
    adapter: {new (prefix: string, ...args: TArgs[]): TClass},
    args?: TArgs
}

export type WoltageConfig = {
    eventStore: EventStoreAdapterConfig,
    /**
     * An array of event classes or a path to a directory to import event classes from.
     *
     * Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.
     */
    eventClasses: (typeof Event)[] | string
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
    stores?: Record<string, StoreAdapterConfig>
    /**
     * Boolean indicating if Woltage should start automatically after creation. Use `woltage.start()` to start manually.
     *
     * Default: true
     */
    autostart?: boolean
}
