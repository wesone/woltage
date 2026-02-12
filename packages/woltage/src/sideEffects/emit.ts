import type Event from '../Event.ts';
import sideEffect from './sideEffect.ts';
import {readStore, projectionStorage} from '../localStorages.ts';

export default sideEffect(
    async (aggregateType: string, event: Event | Event[]) => {
        const events = !Array.isArray(event)
            ? [event]
            : event;

        if(!events.length)
            return;

        const {eventStore} = readStore(projectionStorage);
        const eventGroups = new Map();
        for(const event of events)
        {
            if(!eventGroups.has(event.aggregateId))
                eventGroups.set(event.aggregateId, []);
            eventGroups.get(event.aggregateId).push(event);
        }

        const appendPromises = [];
        for(const [aggregateId, events] of eventGroups.entries())
            appendPromises.push(eventStore.append(aggregateType, aggregateId, events));
        await Promise.all(appendPromises);
    },
);
