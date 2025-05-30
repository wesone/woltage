import {z} from 'zod/v4';
import NotFoundError from '../errors/NotFoundError.ts';
import Event from '../Event.ts';
import EventStore from '../EventStore.ts';
import {
    STATE_NEW,
    type AppendRevision
} from '../adapters/EventStore.ts';
import EventRegistry from '../EventRegistry.ts';
import {executionStorage} from '../localStorages.ts';
import validate from '../validate.ts';

type AggregateProjector<TState = any> = {
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

type CommandContext = {
    aggregateId: string
};

type Command<TState, TPayload extends z.ZodTypeAny = any> = (state: TState, payload: z.infer<TPayload>, context: CommandContext) => Promise<Event | Event[] | void> | Event | Event[] | void;

class Aggregate<TState = any>
{
    declare ['constructor']: typeof Aggregate;

    static create<TState>(name: string, projector: AggregateProjector<TState>) {
        return new this<TState>(name, projector);
    }

    name: string;
    projector: AggregateProjector<TState>;
    #registry: EventRegistry;
    #commands: {[commandName: string]: {schema: z.ZodTypeAny, command: Command<TState>}} = {};

    private constructor(name: string, projector: AggregateProjector<TState>) {
        this.name = name;
        this.projector = projector;
        this.#registry = new EventRegistry(projector);
    }

    registerCommand(command: Command<TState>, commandName?: string): void;
    registerCommand<TPayload extends z.ZodTypeAny = any>(schema: TPayload, command: Command<TState, TPayload>, commandName?: string): void;
    registerCommand(schema: any, command: any, commandName?: any) {
        if(typeof schema === 'function')
        {
            commandName = command;
            command = schema;
            schema = z.any();
        }

        commandName = commandName ?? command.name;
        if(!commandName.length)
            throw new Error('Command has no name. Provide a named function or the commandName argument to registerCommand.');
        if(this.#commands[commandName])
            throw new Error(`Command '${commandName}' already exists in aggregate '${this.name}'.`);
        this.#commands[commandName] = {schema, command};
    }

    async #getStatus(aggregateId: string) {
        const events = EventStore.read(this.name, aggregateId);
        const status = {
            state: (this.projector.$init?.() ?? {}) as TState,
            revision: STATE_NEW as AppendRevision,
        };
        try
        {
            for await (const event of events)
            {
                status.revision = event.position;
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

        const {schema, command} = this.#commands[commandName];
        payload = validate(schema, payload);

        const {state, revision} = await this.#getStatus(aggregateId);
        const context = Object.freeze({
            ...(executionStorage.getStore()?.context ?? {}),
            aggregateId
        });
        let events = await command(state, payload, context);
        if(!events)
            return;

        if(!Array.isArray(events))
            events = [events];
        events.forEach(event => {
            event.aggregateId = aggregateId;
        });
        await EventStore.append(
            this.name,
            aggregateId,
            events,
            revision
        );
    }
}

export default Aggregate;
