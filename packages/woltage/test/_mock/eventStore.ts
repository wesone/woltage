import {type Mock, mock} from 'node:test';
import {
    type AppendRevision,
    type Filter,
    type SubscribeOptions,
    type ReadOptions,
    type IEventStore,
    type SubscriptionStream,
    STATE_NEW,
    STATE_EXISTS,
    BACKWARDS,
    START,
    END
} from '../../src/adapters/EventStore.ts';
import Event from '../../src/Event.ts';
import NotFoundError from '../../src/errors/NotFoundError.ts';
import ConflictError from '../../src/errors/ConflictError.ts';

type MockedEventStore = IEventStore & {append: Mock<IEventStore['append']>, read: Mock<IEventStore['read']>}

class EventStore implements MockedEventStore
{
    state: {existingEvents: {[aggregateType: string]: Event[]}} = {
        existingEvents: {}
    };

    read: Mock<IEventStore['read']>;
    append: Mock<IEventStore['append']>;

    constructor() {
        const state = this.state;

        this.read = mock.fn(
            (aggregateType: string, aggregateId: string, options?: ReadOptions) => (async function* () {
                if(!state.existingEvents[aggregateType]?.length)
                    throw new NotFoundError();
                const events = state.existingEvents[aggregateType]
                    .map((event, idx) => {
                        event.position = BigInt(idx + 1);
                        return event;
                    })
                    .filter(event => event.aggregateId === aggregateId);

                if(
                    options?.fromRevision === START && options?.direction === BACKWARDS
                    || options?.fromRevision === END && options?.direction !== BACKWARDS
                )
                    return;
                if(typeof options?.fromRevision === 'bigint')
                    events.splice(
                        options?.direction === BACKWARDS ? Number(options?.fromRevision) : 0,
                        options?.direction === BACKWARDS ? events.length : Number(options?.fromRevision) - 1
                    );
                if(options?.direction === BACKWARDS)
                    events.reverse();

                while(events.length)
                {
                    const event = events.shift() as Event;
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
                        position: event.position
                    }, false);
                }
            })()
        );

        this.append = mock.fn(
            (aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision) => {
                state.existingEvents[aggregateType] ??= [];
                const currentEvents = state.existingEvents[aggregateType].filter(event => event.aggregateId === aggregateId);
                if(
                    revision === STATE_NEW && currentEvents.length
                    || revision === STATE_EXISTS && !currentEvents.length
                    || (typeof revision === 'bigint' && revision < BigInt(currentEvents.length))
                )
                    return Promise.reject(new ConflictError());

                state.existingEvents[aggregateType].push(...events);
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

    mock(existingEvents: {[aggregateType: string]: Event[]}) {
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
