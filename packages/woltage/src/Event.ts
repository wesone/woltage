import {randomUUID} from 'crypto';
import {z} from 'zod/v4';
import {projectionStorage} from './localStorages.ts';
import {getEventClass} from './eventMap.ts';

type NewEventData<TPayload extends z.ZodType, TMeta = any> = {
    aggregateId?: string,
    payload: z.infer<TPayload>,
    meta?: TMeta
};

type EventData<TPayload extends z.ZodType, TMeta = any> = NewEventData<TPayload> & {
    id: string,
    type: string,
    version: number,
    timestamp: number,
    aggregateId: string
    correlationId: string,
    causationId: string | null,
    meta: TMeta,
    position: bigint
};

export type EventConstructionData<TPayload extends z.ZodType, TMeta = any> = EventData<TPayload, TMeta> | NewEventData<TPayload, TMeta>;

export type EventIdentity = {
    type: string,
    version: number,
}

export default class Event<TPayload extends z.ZodType = any, TMeta = any> implements EventData<TPayload, TMeta>
{
    /**
     * @see https://github.com/Microsoft/TypeScript/issues/3841#issuecomment-337560146
     * @see https://github.com/microsoft/TypeScript/issues/3841#issuecomment-2381594311
     */
    declare ['constructor']: typeof Event;

    static schema: z.ZodType = z.any();
    static version: number = -1;

    static toString() {
        return this.name.replace(/\W+/g, ' ')
            .split(/ |\B(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join('.');
    }

    static get type() {
        return this.toString();
    }

    static get identity() {
        return JSON.stringify({
            type: this.type,
            version: this.version,
        });
    }

    static validate(payload: unknown) {
        return this.schema.parse(payload);
    }

    static fromJSON(data: EventData<any>, shouldValidate: boolean = false) {
        return new (getEventClass(data.type, data.version))(data, shouldValidate);
    }

    static getDisplayName(type = this.type, version = this.version) {
        return `${type}@${version}`;
    }

    id: string;
    timestamp: number;
    aggregateId: string;
    payload: z.infer<TPayload>;
    correlationId: string;
    causationId: string | null;
    meta: TMeta;
    position: bigint;

    constructor(data: EventConstructionData<TPayload, TMeta>, shouldValidate: boolean = true) {
        if(typeof this.version !== 'number' || this.version <= 0)
            throw new Error('Event\'s version property must be a number > 0.');
        if(typeof this.constructor.schema?.parse !== 'function')
            throw new Error(`Missing schema for event class '${this.getDisplayName()}'.`);
        if('type' in data && this.type !== data.type)
            throw new Error(`Event type does not match event data ("${this.type}" not equal "${data.type}").`);
        if('version' in data && this.version !== data.version)
            throw new Error(`Event version does not match event data ("${this.version}" not equal "${data.version}").`);

        const {
            id = randomUUID(),
            timestamp = Date.now(),
            aggregateId,
            payload,
            correlationId,
            causationId,
            meta = {},
            position = -1n
        } = data as EventData<TPayload>;

        this.id = id;
        this.timestamp = timestamp;
        this.aggregateId = aggregateId;
        this.payload = payload;
        const currentEvent = projectionStorage.getStore()?.currentEvent;
        this.correlationId = correlationId ?? currentEvent?.correlationId ?? id;
        this.causationId = causationId ?? currentEvent?.id ?? null;
        this.meta = meta;
        this.position = position;

        this.payload = shouldValidate
            ? this.constructor.validate(data.payload)
            : data.payload;
    }

    toString() {
        return this.constructor.toString();
    }

    get type() {
        return this.toString();
    }

    get version() {
        return this.constructor.version;
    }

    get identity() {
        return this.constructor.identity;
    }

    toJSON() {
        if(!this.aggregateId)
            throw new Error(`Invalid event state. Missing aggregate ID for '${this.getDisplayName()}' event.`);
        return {
            id: this.id,
            type: this.type,
            version: this.version,
            timestamp: this.timestamp,
            aggregateId: this.aggregateId,
            payload: structuredClone(this.payload),
            correlationId: this.correlationId,
            causationId: this.causationId,
            meta: this.meta,
            position: this.position
        };
    }

    getDisplayName() {
        return this.constructor.getDisplayName();
    }
}
