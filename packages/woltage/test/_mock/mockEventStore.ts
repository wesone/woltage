import {type Mock, mock} from 'node:test';
import EventStore from '../../src/EventStore.ts';
import {type AppendRevision, STATE_NEW} from '../../src/adapters/EventStore.ts';
import type Event from '../../src/Event.ts';
import NotFoundError from '../../src/errors/NotFoundError.ts';
import ConflictError from '../../src/errors/ConflictError.ts';

export default (existingEvents: {[aggregateName: string]: Event[]} = {}) => {
    mock.method(
        EventStore,
        'read',
        (aggregateName: string, aggregateId: string) => (async function* () {
            if(!existingEvents[aggregateName] || !existingEvents[aggregateName].length)
                throw new NotFoundError();
            const events = existingEvents[aggregateName].filter(event => event.aggregateId === aggregateId);
            let revision = 0n;
            while(events.length)
            {
                const event = events.shift() as Event;
                revision++;
                yield {
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
                };
            }
        })()
    );
    mock.method(
        EventStore,
        'append',
        (aggregateName: string, aggregateId: string, events: Event[], revision: AppendRevision) => {
            existingEvents[aggregateName] ??= [];
            const currentEvents = existingEvents[aggregateName].filter(event => event.aggregateId === aggregateId);
            if(
                revision === STATE_NEW && currentEvents.length
                || (typeof revision === 'bigint' && revision < BigInt(currentEvents.length))
            )
                return Promise.reject(new ConflictError());

            existingEvents[aggregateName].push(...events);
            return Promise.resolve();
        }
    );
    return EventStore as typeof EventStore & {append: Mock<typeof EventStore.append>, read: Mock<typeof EventStore.read>};
};
