import z from 'zod';
import NotFoundError from '../errors/NotFoundError.ts';
import Event from '../Event.ts';
import type {EventIdentity} from '../Event.ts';
import {
    STATE_NEW,
    type AppendRevision
} from '../adapters/EventStore.ts';
import EventRegistry from '../EventRegistry.ts';
import {readContext, executionStorage} from '../localStorages.ts';
import validate from '../utils/validate.ts';
import type {SnapshotConfig} from './Snapshotter.ts';
import Snapshotter from './Snapshotter.ts';

export type AggregateProjector<TState = any> = {
    /**
     * Return an initial state.
     */
    $init?: () => TState,
    /**
     * Called for each event that has no designated handler in this projector.
     */
    $all?: (state: TState, event: Event) => TState,
} & {
    /**
     * Explicit event handler.
     */
    [eventIdentity in EventIdentity]?: (state: TState, event: Event) => TState
}

export type AggregateOptions = {
    /**
     * Set a snapshot config for this aggregate.
     * The settings take precedence over the global snapshot configuration.
     * If `false`, snapshots are not used, even if a global snapshot config was set.
     *
     * Default: `false`
     */
    snapshots?: SnapshotConfig | false,
    /**
     * Set a version for the projector.
     * Used to determine if a snapshot is still valid or needs to be discarded.
     *
     * Default: `0`
     */
    projectorVersion?: number,
};

export type AggregateStatus<TState = any> = {
    aggregateId: string,
    aggregateVersion: number,
    projectorVersion: number
    state: TState,
    revision: AppendRevision,
}

export type CommandContext<TContext extends object = Record<string, never>> = TContext & {
    aggregateId: string,
    aggregateVersion: number
};

export type StateUpdateConfig = {
    /**
     * If `true`, optimistic concurrency control will be disabled for this operation.
     * The event(s) will be appended regardless of the state being outdated.
     *
     * Default: `false`
     */
    force?: boolean,
    event: Event | Event[]
};

export type StateUpdate = Event | Event[] | StateUpdateConfig;

export type Command<TState, TPayload extends z.ZodType = any> = (state: TState, payload: z.infer<TPayload>, context: CommandContext) => Promise<StateUpdate | void> | StateUpdate | void;

export type CommandOptions = {
    /**
     * The name of the command.
     * Set this if the command function has no name or if you want to override its name.
     */
    name?: string
};

export type CommandInfo<TState, TPayload extends z.ZodType = any> = {
    aggregate: Aggregate<TState>,
    name: string,
    schema: TPayload,
    command: Command<TState, TPayload>,
    options: CommandOptions
}

class Aggregate<TState = any>
{
    declare ['constructor']: typeof Aggregate;

    static create<TState>(type: string, projector: AggregateProjector<TState>, options?: AggregateOptions) {
        return new this<TState>(type, projector, options);
    }

    #type;
    projector;
    options;
    #registry;
    #commands: {[commandName: string]: {schema: z.ZodType, command: Command<TState>, options: CommandOptions}} = {};
    snapshotter;

    private constructor(type: string, projector: AggregateProjector<TState>, options: AggregateOptions = {}) {
        this.#type = type;
        this.projector = projector;
        this.options = options;
        this.#registry = new EventRegistry(projector);
        this.snapshotter = new Snapshotter(type);
    }

    get type() {
        return this.#type;
    }

    registerCommand(command: Command<TState>, options?: CommandOptions): CommandInfo<TState>;
    registerCommand<TPayload extends z.ZodType = any>(schema: TPayload, command: Command<TState, TPayload>, options?: CommandOptions): CommandInfo<TState, TPayload>;
    registerCommand(schema: any, command: any, options?: any) {
        if(typeof schema === 'function')
        {
            options = command;
            command = schema;
            schema = z.any();
        }
        options ??= {};

        const name = options.name ?? command.name;
        if(!name.length)
            throw new Error('Command has no name. Provide a named function or options.name to registerCommand.');
        if(this.#commands[name])
            throw new Error(`Command '${name}' already exists in aggregate '${this.type}'.`);
        this.#commands[name] = {schema, command, options};
        return {
            aggregate: this,
            name,
            schema,
            command,
            options
        };
    }

    async #statusHydrator(status: AggregateStatus<TState>) {
        const {eventStore} = readContext(executionStorage);
        const events = eventStore.read(
            this.type,
            status.aggregateId,
            {
                fromRevision: typeof status.revision === 'bigint'
                    ? status.revision + 1n
                    : undefined
            }
        );
        try
        {
            for await (const event of events)
            {
                status.revision = BigInt(status.aggregateVersion);
                status.aggregateVersion++;
                const {event: transformedEvent, handler = this.projector.$all} = await this.#registry.get(event);
                status.state = handler?.(status.state, transformedEvent) ?? status.state;
            }

            return status;
        }
        catch(error)
        {
            if(error instanceof NotFoundError)
                return status;
            throw error;
        }
    }

    async #getStatus(aggregateId: string) {
        return this.snapshotter.hydrateStatus(
            {
                aggregateId,
                aggregateVersion: 0,
                projectorVersion: this.options.projectorVersion ?? 0,
                state: (this.projector.$init?.() ?? {}) as TState,
                revision: STATE_NEW
            },
            this.#statusHydrator.bind(this)
        );
    }

    async executeCommand(aggregateId: string, commandName: string, payload: any) {
        if(!this.#commands[commandName])
            throw new NotFoundError(`Command ${commandName} not found for aggregate ${this.type}.`);

        const {schema, command/* , options */} = this.#commands[commandName];
        payload = validate(schema, payload);

        const {state, revision, aggregateVersion, postHydrationPromise} = await this.#getStatus(aggregateId);
        const {eventStore, context} = readContext(executionStorage);
        const stateUpdate = await command(
            state,
            payload,
            Object.freeze({
                ...(context as any ?? {}),
                aggregateId,
                aggregateVersion
            })
        );

        if(stateUpdate)
        {
            const {event, force} = !('event' in stateUpdate)
                ? {force: false, event: stateUpdate}
                : stateUpdate;

            const events = !Array.isArray(event) ? [event] : event;
            events.forEach(event => {
                event.aggregateId = aggregateId;
            });
            await eventStore.append(
                this.type,
                aggregateId,
                events,
                force ? undefined : revision
            );
        }

        await postHydrationPromise;
    }
}

export default Aggregate;
