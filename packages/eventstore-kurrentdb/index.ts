import {
    Event,
    TombstoneEvent,
    ConflictError,
    GoneError,
    NotFoundError,
    START,
    END,
    STATE_NEW,
    STATE_EXISTS,
    FORWARDS,
    BACKWARDS,
    type IEventStore,
    type AppendRevision,
    type Filter,
    type ReadOptions,
    type SubscribeOptions
} from 'woltage';
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
    StreamDeletedError,
    eventTypeFilter,
    jsonEvent,
    type JSONEventOptions,
    type Position,
    type ReadStreamOptions,
    type ResolvedEvent,
    type SubscribeToAllOptions
} from '@kurrent/kurrentdb-client';
import {Transform} from 'stream';

type SerializedJSONEvent = JSONEventOptions<{
    id: string;
    type: string;
    data: any;
    metadata: {
        version: number;
        timestamp: string;
        aggregateId: string;
        correlationId: string;
        causationId: string | null;
        meta: unknown;
    };
    position: Position;
}>;

// for KurrentDB versions 22.6.0 or later the position property always exists
type EventRecord = ResolvedEvent<SerializedJSONEvent>['event'] & {position: Position}

const CONSTANTS = Object.freeze({
    [START]: KURRENT_START,
    [END]: KURRENT_END,
    [STATE_NEW]: NO_STREAM,
    [STATE_EXISTS]: STREAM_EXISTS,
    [FORWARDS]: KURRENT_FORWARDS,
    [BACKWARDS]: KURRENT_BACKWARDS
});

export default class KurrentDBEventStore implements IEventStore
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

    #getStreamName(aggregateType: string, aggregateId: string) {
        return `${aggregateType}-${aggregateId}`;
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

    #deserializeEvent(event: EventRecord) {
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
            revision,
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
            // https://github.com/kurrent-io/KurrentDB-Client-NodeJS/issues/513
            revision: typeof revision === 'number' ? BigInt(revision) : revision,
            position
        }, false);
    }

    read(aggregateType: string, aggregateId: string, options?: ReadOptions) {
        const opts: ReadStreamOptions = {};
        if(options?.fromRevision)
        {
            opts.fromRevision = typeof options.fromRevision === 'string'
                ? CONSTANTS[options.fromRevision]
                : options.fromRevision;
        }
        if(options?.direction)
            opts.direction = CONSTANTS[options.direction];

        const stream = this.#client.readStream(this.#getStreamName(aggregateType, aggregateId), opts);
        const deserializeEvent = this.#deserializeEvent.bind(this);
        return (async function* () {
            try
            {
                for await (const resolvedEvent of stream)
                {
                    if(!resolvedEvent.event)
                        continue;

                    yield deserializeEvent(resolvedEvent.event as EventRecord);
                }
            }
            catch(e)
            {
                if(
                    e instanceof StreamNotFoundError
                    || e instanceof StreamDeletedError
                )
                    throw new NotFoundError(e.message);
                throw e;
            }
        })();
    }

    async append(aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision) {
        try
        {
            const sendTombstone = events.some((event, idx) => {
                if(event instanceof TombstoneEvent)
                {
                    if(idx === events.length - 1)
                        return true;
                    throw new ConflictError(`Tombstone event is not the last event to append in ${aggregateType} aggregate ${aggregateId}.`);
                }
                return false;
            });

            const streamName = this.#getStreamName(aggregateType, aggregateId);
            const appendResult = await this.#client.appendToStream(
                streamName,
                events.map(event => this.#serializeEvent(event)),
                {
                    streamState: typeof revision === 'string'
                        ? CONSTANTS[revision]
                        : revision
                }
            );

            if(sendTombstone)
                await this.#client.tombstoneStream(
                    streamName,
                    {
                        expectedRevision: revision !== undefined
                            ? appendResult.nextExpectedRevision
                            : undefined
                    }
                );
        }
        catch(e)
        {
            if(e instanceof WrongExpectedVersionError)
                throw new ConflictError(`State of ${aggregateType} aggregate ${aggregateId} changed in the meantime.`);
            if(e instanceof StreamDeletedError)
                throw new GoneError(`State of ${aggregateType} aggregate ${aggregateId} is not available anymore.`);
            throw e;
        }
    }

    subscribe(options?: SubscribeOptions) {
        const opts: SubscribeToAllOptions = {};
        if(options?.fromPosition)
        {
            opts.fromPosition = typeof options.fromPosition === 'string'
                ? CONSTANTS[options.fromPosition]
                : {commit: options.fromPosition, prepare: options.fromPosition};
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
            fromPosition: KURRENT_END,
            direction: KURRENT_BACKWARDS,
            maxCount: 1,
            filter: kurrentFilter
        });
        for await (const resolvedEvent of events)
            if(resolvedEvent.event?.position)
                return resolvedEvent.event.position.commit;
        return null;
    }
}
