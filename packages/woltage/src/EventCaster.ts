// import type {z} from 'zod/v4';
import Event from './Event.ts';
import eventMap from './eventMap.ts';

export default class EventCaster
{
    static CASTING_DIRECTIONS = Object.freeze({
        UP: 'up',
        DOWN: 'down',
    });

    static CASTING_ERRORS = Object.freeze({
        KEY_MISSING: 'Key missing',
        TYPE_CHANGED: 'Type changed',
    });

    static async cast(event: Event, targetVersion: number) {
        event = new event.constructor(event, false);

        const eventType = event.type;
        const eventVersion = event.version;

        // no casting needed
        if(eventVersion === targetVersion)
            return event;

        // eventMap is not up to date
        if(!eventMap[eventType]?.[eventVersion] || !eventMap[eventType]?.[targetVersion])
        {
            throw new Error(`Event casting from '${event.getDisplayName()}' to '${Event.getDisplayName(eventType, targetVersion)}' failed because eventMap is not up to date.`);
            //TODO implement remote casting to some service that always has the latest event updates
        }

        const direction = targetVersion - eventVersion < 0 ? -1 : 1;
        for(let v = eventVersion + direction; v !== targetVersion + direction; v += direction)
        {
            // const EventClass = eventMap[eventType][v];
            // event.payload = EventClass.validate(); //TODO transform payload
        }

        return event;
    }

    static isCastable(/* castingDirection: (typeof this.CASTING_DIRECTIONS)[keyof typeof this.CASTING_DIRECTIONS], sourceCodec: z.ZodType, targetCodec: z.ZodType, path: string[] = [], isOptional: boolean = false */) {
        /*
          +–––––––––––––––––––––+––––––––––––––––––––––––––––––+–––––––––––––––––––––––––––––––+–––––––––––––––––––––-––––––––+
          | Field is            |    Field will be deleted     |      Field will be added      |   Field's type will change   |
          +–––––––––––––––––––––+––––––––––––––––––+–––––––––––+–––––––––––––+–––––––––––––––––+–––––––––––––––+––––––––––––––+
          |                     |___ down cast ____|_ up cast _|_ down cast _|____ up cast ____|__ down cast __|__ up cast ___|
          | Required            |         n        |     y     |      y      |        n        |       n       |      n       |
          | Required (default)  |  y (set default) |     y     |      y      | y (set default) |       n       |      n       |
          | Optional            |         y        |     y     |      y      |        y        |       n       |      n       |
          +–––––––––––––––––––––+––––––––––––––––––+–––––––––––+–––––––––––––+–––––––––––––––––+––––––––––––––––––––––––––––––+
        */
    }
}
