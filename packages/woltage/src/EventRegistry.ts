import type Event from './Event.ts';
import type {EventIdentity} from './Event.ts';
import EventCaster from './EventCaster.ts';

type HandlerMap = {
    [eventType: string]: {
        [version: number]: Function
    }
};

export default class EventRegistry
{
    #handlerMap: HandlerMap;

    /**
     *
     * @param {any} obj The object to receive handler properties from.
     * @param {any} [proto] Optional prototype in case the prototype is different from `obj`.
     */
    constructor(obj: any, proto?: any) {
        this.#handlerMap = Object.getOwnPropertyNames(proto ?? obj)
            .filter(property => property.startsWith('{') && property.endsWith('}'))
            .reduce((map, eventIdentity) => {
                const {type, version} = JSON.parse(eventIdentity) as EventIdentity;
                map[type] ??= {};
                map[type][version] = obj[eventIdentity].bind(obj);
                return map;
            }, {} as HandlerMap);
    }

    get types() {
        return Object.keys(this.#handlerMap);
    }

    async get(event: Event): Promise<{event: Event, handler: Function | undefined }> {
        const handlers = this.#handlerMap[event.type];
        const handler = handlers?.[event.version];
        if(handlers && !handler)
            event = await EventCaster.cast(
                event,
                Object.keys(handlers)
                    .map(v => parseInt(v, 10))
                    .sort((a, b) => b - a)
                    [0]
            );
        return {
            event,
            handler
        };
    }
}
