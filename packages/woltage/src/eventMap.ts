import Event from './Event.ts';
import z from 'zod';

type EventMap = {
    [eventType: string]: {
        [eventVersion: number]: typeof Event
    }
};

const eventMap: EventMap = {};

export const registerEventClasses = (eventClasses: (typeof Event)[]) => {
    eventClasses.forEach(EventClass => {
        eventMap[EventClass.type] ??= {};
        if(eventMap[EventClass.type][EventClass.version])
            throw new Error(`Duplicate event class found. Event '${EventClass.getDisplayName()}' already exists.`);
        eventMap[EventClass.type][EventClass.version] = EventClass;
    });
};

export const getEventClass = (eventType: string, version: number): typeof Event => eventMap[eventType]?.[version] ?? (
    class UnknownEvent extends Event {
        static toString() {
            return eventType;
        }
        static version = version;
        static schema = z.unknown();
    }
);

export default eventMap;
