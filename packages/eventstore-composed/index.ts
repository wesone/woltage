import type {
    AdapterConfig,
    AppendRevision,
    Event,
    Filter,
    ReadOptions,
    SubscribeOptions,
    SubscriptionStream,
    IEventStore
} from 'woltage';

export interface IEventLog {
    connect(): Promise<void>;
    close(force?: boolean): Promise<void>;
    read(aggregateType: string, aggregateId: string, options?: ReadOptions): AsyncIterableIterator<Event>;
    /**
     * @returns Promise of the events that should now contain their position inside the log.
     */
    append(aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision): Promise<Event[]>;
    getLatestPosition(filter?: Filter): Promise<bigint | null>;
}

export interface IEventBus {
    connect(log: IEventLog): Promise<void>;
    close(force?: boolean): Promise<void>;
    publish(aggregateType: string, aggregateId: string, events: Event[]): Promise<void>;
    subscribe(options?: SubscribeOptions): SubscriptionStream;
}

export default class ComposedEventStore implements IEventStore
{
    log;
    bus;

    constructor(
        log: AdapterConfig<new (...args: any) => IEventLog>,
        bus: AdapterConfig<new (...args: any) => IEventBus>
    ) {
        this.log = new log.adapter(...(log.args ?? []));
        this.bus = new bus.adapter(...(bus.args ?? []));
    }

    async connect() {
        await Promise.all([
            this.log.connect(),
            this.bus.connect(this.log)
        ]);
    }

    async close(force?: boolean) {
        await Promise.all([
            this.log.close(force),
            this.bus.close(force)
        ]);
    }

    read(...args: Parameters<IEventStore['read']>) {
        return this.log.read(...args);
    }

    async append(aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision): Promise<void> {
        events = await this.log.append(
            aggregateType,
            aggregateId,
            events,
            revision
        );
        await this.bus.publish(
            aggregateType,
            aggregateId,
            events
        )
            // If adding the events to the log succeeds, the events are considered as "happened".
            // The bus implementation is responsible for error handling when trying to publish the events.
            .catch();
    }

    subscribe(...args: Parameters<IEventStore['subscribe']>) {
        return this.bus.subscribe(...args);
    }

    getLatestPosition(...args: Parameters<IEventStore['getLatestPosition']>) {
        return this.log.getLatestPosition(...args);
    }
}
