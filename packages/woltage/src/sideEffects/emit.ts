import type Event from '../Event.ts';
import sideEffect from './sideEffect.ts';
import {readStore, projectionStorage} from '../localStorages.ts';

export default sideEffect(
    async ({aggregateName, events}: {aggregateName: string, events: Event | Event[]}) => {
        if(!Array.isArray(events))
            events = [events];
        const eventGroups = new Map();
        for(const event of events)
        {
            if(!eventGroups.has(event.aggregateId))
                eventGroups.set(event.aggregateId, []);
            eventGroups.get(event.aggregateId).push(event);
        }
        for(const [aggregateId, events] of eventGroups.entries())
            await readStore(projectionStorage).eventStore.append(aggregateName, aggregateId, events);
    },
);
