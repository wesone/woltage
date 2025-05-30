import {Event, IEventStore, ReadOptions, AppendRevision, Filter, SubscribeOptions, NotFoundError} from 'woltage';
import {START, END, STATE_NEW, STATE_EXISTS, FORWARDS, BACKWARDS, ConflictError} from 'woltage';
import {
    KurrentDBClient,
    START as KURRENT_START,
    END as KURRENT_END,
    NO_STREAM,
    STREAM_EXISTS,
    FORWARDS as KURRENT_FORWARDS,
    BACKWARDS as KURRENT_BACKWARDS,

    WrongExpectedVersionError,
    StreamNotFoundError,
    ReadStreamOptions,
    eventTypeFilter,
    SubscribeToAllOptions,
    jsonEvent,
    Position,
    JSONEventOptions,
    ResolvedEvent,
} from '@kurrent/kurrentdb-client';
import {Transform} from 'stream';

type SerializedJSONEvent = JSONEventOptions<{
    id: string;
    type: string;
    data: any;
    metadata: {
        version: number;
        timestamp: number;
        aggregateId: string;
        correlationId: string;
        causationId: string | null;
        meta: any;
    };
    position: Position;
}>;

const CONSTANTS = Object.freeze({
    [START]: KURRENT_START,
    [END]: KURRENT_END,
    [STATE_NEW]: NO_STREAM,
    [STATE_EXISTS]: STREAM_EXISTS,
    [FORWARDS]: KURRENT_FORWARDS,
    [BACKWARDS]: KURRENT_BACKWARDS
});

export default class KurrentDBAdapter implements IEventStore
{
    #client: KurrentDBClient;

    constructor(connectionString: string) {
        this.#client = KurrentDBClient.connectionString`${connectionString}`;
    }

    connect() {
        // const {serverVersion} = await this.#client.capabilities;
        // warn if serverVersion is lower than '22.6.0'
        return Promise.resolve();
    }

    async close() {
        await this.#client.dispose();
    }

    #getStreamName(aggregateName: string, aggregateId: string) {
        return `${aggregateName}-${aggregateId}`;
    }

    #serializeEvent(event: Event) {
        return jsonEvent({
            type: event.type,
            id: event.id,
            data: structuredClone(event.payload),
            metadata: {
                version: event.version,
                timestamp: event.timestamp,
                aggregateId: event.aggregateId,
                correlationId: event.correlationId,
                causationId: event.causationId,
                meta: event.meta
            }
        });
    }

    #deserializeEvent(event: SerializedJSONEvent) {
        const {
            id,
            type,
            data: payload,
            metadata: {
                version,
                timestamp,
                aggregateId,
                correlationId,
                causationId,
                meta
            },
            position: {commit: position}
        } = event;
        return Event.fromJSON({
            id,
            type,
            version,
            timestamp,
            aggregateId,
            payload,
            correlationId,
            causationId,
            meta,
            position
        }, false);
    }

    read(aggregateName: string, aggregateId: string, options?: ReadOptions) {
        const opts: ReadStreamOptions = {};
        if(options?.fromRevision)
        {
            opts.fromRevision = typeof options.fromRevision === 'string'
                ? CONSTANTS[options.fromRevision]
                : options.fromRevision;
        }
        if(options?.direction)
            opts.direction = CONSTANTS[options.direction];

        const stream = this.#client.readStream(this.#getStreamName(aggregateName, aggregateId), opts);
        const deserializeEvent = this.#deserializeEvent.bind(this);
        return (async function* () {
            try
            {
                for await (const resolvedEvent of stream)
                {
                    if(!resolvedEvent.event)
                        continue;

                    yield deserializeEvent(
                        // for KurrentDB versions 22.6.0 or later the position property always exists
                        resolvedEvent.event as ResolvedEvent<SerializedJSONEvent>['event'] & {position: Position}
                    );
                }
            }
            catch(error)
            {
                if(error instanceof StreamNotFoundError)
                    throw new NotFoundError(error.message);
                throw error;
            }
        })();
    }

    async append(aggregateName: string, aggregateId: string, events: Event[], revision?: AppendRevision) {
        try
        {
            await this.#client.appendToStream(
                this.#getStreamName(aggregateName, aggregateId),
                events.map(event => this.#serializeEvent(event)),
                {
                    streamState: typeof revision === 'string'
                        ? CONSTANTS[revision]
                        : revision
                }
            );
        }
        catch(e)
        {
            if(e instanceof WrongExpectedVersionError)
                throw new ConflictError(`State of ${aggregateName} aggregate ${aggregateId} changed in the meantime.`);
            throw e;
        }
    }

    subscribe(options?: SubscribeOptions) {
        const opts: SubscribeToAllOptions = {};
        if(options?.fromRevision)
        {
            opts.fromPosition = typeof options.fromRevision === 'string'
                ? CONSTANTS[options.fromRevision]
                : {commit: options.fromRevision, prepare: options.fromRevision};
        }
        if(options?.filter?.types)
            opts.filter = eventTypeFilter({prefixes: options.filter.types});

        // caughtUp is emitted in the middle of replaying...
        // it is not respecting the pausing and resuming of the subscription stream
        // so we can't use this approach to detect a replay

        const deserializeEvent = this.#deserializeEvent.bind(this);
        return this.#client.subscribeToAll(opts)
            .pipe(
                new Transform({
                    objectMode: true,
                    transform(resolvedEvent, encoding, callback) {
                        if(resolvedEvent.event)
                            this.push(deserializeEvent(resolvedEvent.event));
                        callback();
                    }
                })
            );
    }

    async getLatestPosition(filter?: Filter) {
        const kurrentFilter = filter?.types
            ? eventTypeFilter({prefixes: filter.types})
            : undefined;

        const events = this.#client.readAll({
            fromPosition: END,
            direction: BACKWARDS,
            maxCount: 1,
            filter: kurrentFilter
        });
        for await (const resolvedEvent of events)
            if(resolvedEvent.event?.position)
                return resolvedEvent.event.position.commit;
        return null;
    }
}
