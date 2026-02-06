import z from 'zod';
import NotFoundError from '../errors/NotFoundError.ts';
import Event from '../Event.ts';
import {
    STATE_NEW,
    type AppendRevision
} from '../adapters/EventStore.ts';
import EventRegistry from '../EventRegistry.ts';
import {readStore, executionStorage} from '../localStorages.ts';
import validate from '../utils/validate.ts';

export type AggregateProjector<TState = any> = {
    /**
     * To set an initial state.
     */
    $init?: () => TState,
    /**
     * Called for each event that has no designated handler in this projector.
     */
    $all?: (state: TState, event: Event) => TState,
} & {
    [eventIdentity: string]: (state: TState, event: Event) => TState
};

export type CommandContext<TContext extends object = Record<string, never>> = TContext & {
    aggregateId: string,
    aggregateVersion: number
};

export type StateUpdateConfig = {
    /**
     * If `true`, optimistic concurrency control will be disabled for this operation.
     * The event will be appended regardless of the state being outdated.
     */
    force: boolean,
    event: Event | Event[]
};

export type StateUpdate = Event | Event[] | StateUpdateConfig | void;

export type Command<TState, TPayload extends z.ZodType = any> = (state: TState, payload: z.infer<TPayload>, context: CommandContext) => Promise<StateUpdate> | StateUpdate;

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

    static create<TState>(name: string, projector: AggregateProjector<TState>) {
        return new this<TState>(name, projector);
    }

    name: string;
    projector: AggregateProjector<TState>;
    #registry: EventRegistry;
    #commands: {[commandName: string]: {schema: z.ZodType, command: Command<TState>, options: CommandOptions}} = {};

    private constructor(name: string, projector: AggregateProjector<TState>) {
        this.name = name;
        this.projector = projector;
        this.#registry = new EventRegistry(projector);
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
            throw new Error(`Command '${name}' already exists in aggregate '${this.name}'.`);
        this.#commands[name] = {schema, command, options};
        return {
            aggregate: this,
            name,
            schema,
            command,
            options
        };
    }

    async #getStatus(aggregateId: string) {
        const events = readStore(executionStorage).eventStore.read(this.name, aggregateId);
        const status = {
            state: (this.projector.$init?.() ?? {}) as TState,
            revision: STATE_NEW as AppendRevision,
            version: 0
        };
        try
        {
            for await (const event of events)
            {
                status.revision = event.position;
                status.version++;
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

    async executeCommand(aggregateId: string, commandName: string, payload: any) {
        if(!this.#commands[commandName])
            throw new NotFoundError(`Command ${commandName} not found for aggregate ${this.name}.`);

        const {schema, command/* , options */} = this.#commands[commandName];
        payload = validate(schema, payload);

        const {eventStore, context} = readStore(executionStorage);
        const {state, revision, version: aggregateVersion} = await this.#getStatus(aggregateId);
        const stateUpdate = await command(
            state,
            payload,
            Object.freeze({
                ...(context ?? {}),
                aggregateId,
                aggregateVersion
            })
        );
        if(!stateUpdate)
            return;

        const {event, force} = !('event' in stateUpdate)
            ? {force: false, event: stateUpdate}
            : stateUpdate;

        const events = !Array.isArray(event) ? [event] : event;
        events.forEach(event => {
            event.aggregateId = aggregateId;
        });
        await eventStore.append(
            this.name,
            aggregateId,
            events,
            force ? undefined : revision
        );
    }
}

export default Aggregate;
