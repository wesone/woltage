import type Event from './Event.ts';
import type {AppendRevision, Filter, IEventStore, SubscribeOptions} from './adapters/EventStore.ts';

export default class EventStore
{
    static #eventStore: IEventStore;

    static async init(eventStore: IEventStore) {
        this.#eventStore = eventStore;
        await this.#eventStore.connect();
    }

    static async close(force = false) {
        await this.#eventStore.close(force);
    }

    static read(aggregateName: string, aggregateId: string) {
        return this.#eventStore.read(aggregateName, aggregateId);
    }

    static async append(aggregateName: string, aggregateId: string, events: Event[], revision?: AppendRevision) {
        await this.#eventStore.append(aggregateName, aggregateId, events, revision);
    }

    static getLatestPosition(filter?: Filter) {
        return this.#eventStore.getLatestPosition(filter);
    }

    static subscribe(options?: SubscribeOptions) {
        return this.#eventStore.subscribe(options);
    }
}
