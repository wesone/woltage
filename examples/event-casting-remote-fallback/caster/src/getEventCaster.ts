import {importModules, Event, EventCaster} from 'woltage';

export default async function getEventCaster()
{
    // Recursively load all existing event classes
    const eventClasses = await importModules<typeof Event>(
        import.meta.dirname + '/events',
        module => module.prototype instanceof Event
    );

    // Construct the lookup map
    const eventMap = eventClasses.reduce((map, EventClass) => {
        map[EventClass.type] ??= {};
        if(map[EventClass.type][EventClass.version])
            throw new Error(`Duplicate event class found. Event '${EventClass.getDisplayName()}' already exists.`);
        map[EventClass.type][EventClass.version] = EventClass;
        return map;
    }, {} as ConstructorParameters<typeof EventCaster>[0]);

    // Create event caster instance
    return new EventCaster(eventMap);
}
