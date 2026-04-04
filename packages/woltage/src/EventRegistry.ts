import type Event from './Event.ts';
import type {EventIdentityData} from './Event.ts';
import EventCaster, {type EventCastingFallback} from './EventCaster.ts';
import eventMap from './eventMap.ts';

export type EventRegistryOptions = {
    /**
     * Optional prototype in case the prototype is different from `obj`.
     */
    proto?: any,
    eventCastingFallback?: EventCastingFallback
};

export default class EventRegistry
{
    /**
     * Each key is an event type.
     *
     * Each value is a Map with a version as key and the corresponding handler as value.
     */
    #handlerMap = new Map<string, Map<number, Function>>();
    /**
     * Each key is an event type.
     *
     * Each value is an array of available versions for the event type.
     *
     * The array is sorted from latest to oldest version.
     */
    #handlerVersions = new Map<string, number[]>();
    #eventCaster: EventCaster;

    readonly types: string[] = [];

    /**
     *
     * @param obj The object to receive handler properties from.
     * @param options
     */
    constructor(obj: any, options?: EventRegistryOptions) {
        Object.getOwnPropertyNames(options?.proto ?? obj)
            .filter(property => property.startsWith('{') && property.endsWith('}'))
            .forEach(eventIdentity => {
                try
                {
                    const {type, version} = JSON.parse(eventIdentity) as EventIdentityData;
                    if(type.length && !isNaN(version))
                    {
                        if(!this.#handlerMap.has(type))
                            this.#handlerMap.set(type, new Map());
                        this.#handlerMap.get(type)?.set(version, obj[eventIdentity].bind(obj));
                    }
                }
                finally
                {
                    return;
                }
            });

        for(const [eventType, handlers] of this.#handlerMap.entries())
        {
            this.types.push(eventType);
            this.#handlerVersions.set(
                eventType,
                [...handlers.keys()].sort((a, b) => b - a)
            );
        }

        this.#eventCaster = new EventCaster(eventMap, {
            fallback: options?.eventCastingFallback
        });
    }

    setEventCastingFallback(fallback?: EventCastingFallback) {
        this.#eventCaster.options.fallback = fallback;
    }

    async get(event: Event) {
        const handlers = this.#handlerMap.get(event.type);
        let handler = handlers?.get(event.version);
        if(handlers && !handler)
        {
            event = await this.#eventCaster.cast(
                event,
                this.#handlerVersions.get(event.type)![0]
            );
            handler = handlers.get(event.version);
        }
        return {
            event,
            handler
        };
    }
}
