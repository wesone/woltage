import {randomUUID} from 'crypto';
import {projectionStorage} from './localStorages.ts';
import {getEventClass} from './eventMap.ts';
import type {StandardSchemaV1} from './adapters/standard-schema.ts';

export type PayloadSchema = StandardSchemaV1;

export type EventInitData<TPayload extends PayloadSchema = any, TMeta = any> = {
    aggregateId?: string,
    payload: StandardSchemaV1.InferInput<TPayload>,
    meta?: TMeta
};

export type EventData<TPayload extends PayloadSchema = any, TMeta = any> = {
    id: string,
    type: string,
    version: number,
    timestamp: string,
    aggregateId: string,
    payload: StandardSchemaV1.InferOutput<TPayload>,
    correlationId: string,
    causationId: string | null,
    meta: TMeta,
    position: bigint
};

export type SerializedEventData<TPayload extends PayloadSchema = any, TMeta = any> = Omit<EventData<TPayload, TMeta>, 'position'> & {position: string};

export type EventConstructionData<TPayload extends PayloadSchema, TMeta = any> = EventData<TPayload, TMeta> | EventInitData<TPayload, TMeta>;

export type EventIdentityData<T extends typeof Event = any> = {
    type: T['type'],
    version: T['version'],
}

export type EventIdentity<T extends typeof Event = any> = `{"type":"${T['type']}","version":${T['version']}}`;

const identityCache: WeakMap<any, EventIdentity> = new WeakMap();

export default class Event<TPayload extends PayloadSchema = any, TMeta = any>
{
    /**
     * @see https://github.com/Microsoft/TypeScript/issues/3841#issuecomment-337560146
     * @see https://github.com/microsoft/TypeScript/issues/3841#issuecomment-2381594311
     */
    declare ['constructor']: typeof Event;

    static readonly schema: PayloadSchema;
    static readonly version: number = -1;

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
        let identity = identityCache.get(this);
        if(!identity)
        {
            identity = JSON.stringify({
                type: this.type,
                version: this.version
            }) as EventIdentity;
            identityCache.set(this, identity);
        }
        return identity;
    }

    static validate(payload: unknown) {
        const result = this.schema['~standard'].validate(payload);
        if(result instanceof Promise)
            throw new Error('Async validation of event schema is not supported.');
        if(result.issues)
            throw new Error(`Event '${this.getDisplayName()}' validation failed.\n${JSON.stringify(result.issues, null, 2)}`);
        return result.value;
    }

    static fromJSON(data: SerializedEventData | EventData | Event, shouldValidate: boolean = false) {
        const eventData = 'toJSON' in data ? data.toJSON() : data;
        if(typeof eventData.position === 'string')
            eventData.position = BigInt(eventData.position.slice(0, -1));
        return new (getEventClass(data.type, data.version))(eventData, shouldValidate);
    }

    static getDisplayName(type = this.type, version = this.version) {
        return `${type}@${version}`;
    }

    id;
    timestamp;
    aggregateId;
    payload: StandardSchemaV1.InferOutput<TPayload>;
    correlationId: string;
    causationId: string | null;
    meta: TMeta;
    position;

    constructor(data: EventConstructionData<TPayload, TMeta>, shouldValidate: boolean = true) {
        if(typeof this.version !== 'number' || this.version <= 0)
            throw new Error('Event\'s version property must be a number > 0.');
        if(typeof this.constructor?.schema['~standard']?.validate !== 'function')
            throw new Error(`Schema for event class '${this.getDisplayName()}' needs to be Standard Schema compliant.`);
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
        this.timestamp = new Date(timestamp);
        this.aggregateId = aggregateId;
        this.payload = payload;
        const currentEvent = projectionStorage.getStore()?.currentEvent;
        this.correlationId = correlationId ?? currentEvent?.correlationId ?? id;
        this.causationId = causationId ?? currentEvent?.id ?? null;
        this.meta = meta as TMeta;
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
            timestamp: this.timestamp.toISOString(),
            aggregateId: this.aggregateId,
            payload: structuredClone(this.payload),
            correlationId: this.correlationId,
            causationId: this.causationId,
            meta: this.meta,
            position: `${this.position}n`
        } satisfies SerializedEventData<TPayload, TMeta>;
    }

    getDisplayName() {
        return this.constructor.getDisplayName();
    }
}
