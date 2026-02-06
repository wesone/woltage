import {type Mock, mock} from 'node:test';
import {
    type AppendRevision,
    type Filter,
    type SubscribeOptions,
    type IEventStore,
    type SubscriptionStream,
    STATE_NEW
} from '../../src/adapters/EventStore.ts';
import Event from '../../src/Event.ts';
import NotFoundError from '../../src/errors/NotFoundError.ts';
import ConflictError from '../../src/errors/ConflictError.ts';

type MockedEventStore = IEventStore & {append: Mock<IEventStore['append']>, read: Mock<IEventStore['read']>}

class EventStore implements MockedEventStore
{
    state: {existingEvents: {[aggregateName: string]: Event[]}} = {
        existingEvents: {}
    };

    read: Mock<IEventStore['read']>;
    append: Mock<IEventStore['append']>;

    constructor() {
        const state = this.state;

        this.read = mock.fn(
            (aggregateName: string, aggregateId: string) => (async function* () {
                if(!state.existingEvents[aggregateName]?.length)
                    throw new NotFoundError();
                const events = state.existingEvents[aggregateName]
                    .filter(event => event.aggregateId === aggregateId);
                let revision = 0n;
                while(events.length)
                {
                    const event = events.shift() as Event;
                    revision++;
                    yield Event.fromJSON({
                        id: event.id,
                        type: event.type,
                        version: event.version,
                        timestamp: event.timestamp,
                        aggregateId: event.aggregateId,
                        payload: event.payload,
                        correlationId: event.correlationId,
                        causationId: event.causationId,
                        meta: event.meta,
                        position: 1000000n + revision
                    }, false);
                }
            })()
        );

        this.append = mock.fn(
            (aggregateName: string, aggregateId: string, events: Event[], revision: AppendRevision) => {
                state.existingEvents[aggregateName] ??= [];
                const currentEvents = state.existingEvents[aggregateName].filter(event => event.aggregateId === aggregateId);
                if(
                    revision === STATE_NEW && currentEvents.length
                    || (typeof revision === 'bigint' && revision < BigInt(currentEvents.length))
                )
                    return Promise.reject(new ConflictError());

                state.existingEvents[aggregateName].push(...events);
                return Promise.resolve();
            }
        );
    }

    connect(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    close(force?: boolean): Promise<void> {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe(options?: SubscribeOptions): SubscriptionStream {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getLatestPosition(filter?: Filter): Promise<bigint | null> {
        throw new Error('Method not implemented.');
    }

    mock(existingEvents: {[aggregateName: string]: Event[]}) {
        this.state.existingEvents = existingEvents;
    }

    mockReset() {
        this.state.existingEvents = {};
        this.read.mock.resetCalls();
        this.append.mock.resetCalls();
    }
}

const eventStore = new EventStore();

export default eventStore;
