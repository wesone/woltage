import type Event from '../Event.ts';
import EventStore from '../EventStore.ts';
import sideEffect from '../read/sideEffect.ts';

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
            await EventStore.append(aggregateName, aggregateId, events);
    },
);
