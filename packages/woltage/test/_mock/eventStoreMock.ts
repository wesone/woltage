import {type Mock, mock} from 'node:test';
import {PassThrough} from 'node:stream';
import {
    type AppendRevision,
    type Filter,
    type SubscribeOptions,
    type ReadOptions,
    type IEventStore,
    STATE_NEW,
    STATE_EXISTS,
    BACKWARDS,
    START,
    END
} from '../../src/adapters/EventStore.ts';
import Event from '../../src/Event.ts';
import NotFoundError from '../../src/errors/NotFoundError.ts';
import ConflictError from '../../src/errors/ConflictError.ts';

class EventStoreMock implements IEventStore
{
    state: {
        existingEvents: {[aggregateType: string]: Event[]}
        subscriptions: {[eventType: string | '$all']: PassThrough[]}
    } = {
            existingEvents: {},
            subscriptions: {
                $all: []
            }
        };

    read: Mock<IEventStore['read']>;
    append: Mock<IEventStore['append']>;
    getLatestPosition: Mock<IEventStore['getLatestPosition']>;
    subscribe: Mock<IEventStore['subscribe']>;

    constructor() {
        const state = this.state;

        this.read = mock.fn(
            (aggregateType: string, aggregateId: string, options?: ReadOptions) => (async function* () {
                if(!state.existingEvents[aggregateType]?.length)
                    throw new NotFoundError();
                const events = state.existingEvents[aggregateType]
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
                    yield Event.fromJSON(event.toJSON(), false);
                }
            })()
        );

        this.append = mock.fn(
            async (aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision) => {
                const pos = await this.getLatestPosition() ?? 0n;

                state.existingEvents[aggregateType] ??= [];
                const currentEvents = state.existingEvents[aggregateType].filter(event => event.aggregateId === aggregateId);
                if(
                    revision === STATE_NEW && currentEvents.length
                    || revision === STATE_EXISTS && !currentEvents.length
                    || (typeof revision === 'bigint' && revision !== BigInt(currentEvents.length - 1))
                )
                    throw new ConflictError();

                events.forEach((event, idx) => event.position = BigInt(pos + 1n + BigInt(idx)));
                state.existingEvents[aggregateType].push(...events);
                this.#onEvents(events);
            }
        );

        this.getLatestPosition = mock.fn(
            async (filter?: Filter) => {
                const pos = filter?.types?.length
                    ? Object.entries(this.state.existingEvents)
                        .filter(([aggregateType]) => filter.types!.includes(aggregateType))
                        .map(([, events]) => events)
                        .flat()
                        .sort((a, b) => Number(b.position - a.position))
                        [0]?.position
                    : Object.values(this.state.existingEvents).flat().length;
                return Promise.resolve(
                    pos
                        ? BigInt(pos)
                        : null
                );
            }
        );

        this.subscribe = mock.fn(
            (options?: SubscribeOptions) => {
                const stream = new PassThrough();


                //TODO write existing events that match options

                (options?.filter?.types ?? ['$all'])
                    .forEach(type => (this.state.subscriptions[type] ??= []).push(stream));

                return stream;
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

    mock(existingEvents: {[aggregateType: string]: Event[]}) {
        this.state.existingEvents = existingEvents;
    }

    mockReset() {
        this.state.existingEvents = {};

        Object.getOwnPropertyNames(this)
            .forEach(prop => {
                if((this as any)[prop].mock)
                    (this as any)[prop].mock.resetCalls();
            });
    }

    #onEvents(events: Event[]) {
        events.forEach(event => {
            [
                this.state.subscriptions.$all,
                this.state.subscriptions[event.type] ?? []
            ]
                .flat()
                .forEach(stream => stream.write(event));
        });
    }
}

const eventStore = new EventStoreMock();

export default eventStore;
