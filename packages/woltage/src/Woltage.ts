import importModules from './utils/importModules.ts';
import Aggregate, {type CommandInfo} from './write/Aggregate.ts';
import Event from './Event.ts';
import {registerEventClasses} from './eventMap.ts';
import Projector from './read/Projector.ts';
import type {IEventStore} from './adapters/EventStore.ts';
import type {IStore} from './adapters/Store.ts';
import z from 'zod';
import {constructAdapter, createStore, createStoreFactory} from './utils/adapterUtils.ts';
import Projection from './read/Projection.ts';
import ConflictError from './errors/ConflictError.ts';
import ProjectionMap from './ProjectionMap.ts';
import ReadModel from './read/ReadModel.ts';
import NotFoundError from './errors/NotFoundError.ts';
import {executionStorage, projectionStorage} from './localStorages.ts';
import type {WoltageConfig} from './WoltageConfig.ts';
import CommandScheduler from './write/CommandScheduler.ts';

export type AggregateMap = {[aggregateType: string]: Aggregate};

export type ProjectorMap = {
    [projectorName: string]: {
        [version: number]: typeof Projector
    }
};

export type Context = Record<string, unknown>;

const internalConfigSchema = {
    projections: {
        key: z.object({
            id: z.string()
        }),
        schema: z.object({
            map: z.record(
                z.string(),
                z.object({
                    activeVersion: z.int().optional(),
                    versions: z.record(
                        z.string(),
                        z.object({
                            projectionId: z.string(),
                            name: z.string(),
                            version: z.int(),
                            projectorName: z.string(),
                            projectorVersion: z.int(),
                            storeName: z.string()
                        })
                    )
                })
            )
        })
    }
};

class Woltage
{
    static #constructAggregateMap(aggregates: Aggregate[]) {
        return aggregates.reduce((map, aggregate) => {
            if(map[aggregate.type])
                throw new Error(`Duplicate aggregate found. Aggregate '${aggregate.type}' already exists.`);
            map[aggregate.type] = aggregate;
            return map;
        }, {} as AggregateMap);
    }

    static #constructProjectorMap(projectorClasses: (typeof Projector)[]) {
        return projectorClasses.reduce((map, ProjectorClass) => {
            map[ProjectorClass.name] ??= {};
            if(map[ProjectorClass.name][ProjectorClass.version])
                throw new Error(`Duplicate projector class found. Projector '${ProjectorClass.getDisplayName()}' already exists.`);
            map[ProjectorClass.name][ProjectorClass.version] = ProjectorClass;
            return map;
        }, {} as ProjectorMap);
    }

    static async create(config: WoltageConfig) {
        const instance = new this(config);
        await instance.#init();
        if(config.autostart !== false)
            await instance.start();
        return instance;
    }

    config;
    #aggregateMap: AggregateMap = {};
    #projectorMap: ProjectorMap = {};
    #readModelMap: Record<string, ReadModel> = {};
    #eventStore: IEventStore;
    #store: IStore<typeof internalConfigSchema>;
    #getStore;
    #projections;
    #commandScheduler?: CommandScheduler;

    constructor(config: WoltageConfig) {
        this.config = config;

        this.#eventStore = constructAdapter(this.config.eventStore);

        this.#store = createStore(this.config.internalStore, '_woltage_config');
        this.#store.defineTables(internalConfigSchema);

        this.#getStore = createStoreFactory(this.config.stores ?? {});

        this.#projections = new ProjectionMap();

        if(this.config.scheduler)
        {
            const executeCommand = this.executeCommand.bind(this);
            this.#commandScheduler = new CommandScheduler(
                this.config.scheduler,
                async (executeAt, data) => {
                    await executeCommand(...(data as Parameters<Woltage['executeCommand']>))
                        .catch(console.info);
                }
            );
        }
    }

    async #loadModules<TModule>(pathOrModules: string | TModule[] | undefined, filter: (module: any) => boolean): Promise<TModule[]> {
        return typeof pathOrModules === 'string'
            ? await importModules(pathOrModules, filter)
            : pathOrModules ?? [];
    }

    async #init() {
        await Promise.all([
            this.#loadModules(
                this.config.eventClasses,
                module => module.prototype instanceof Event
            )
                .then(eventClasses => registerEventClasses(eventClasses)),
            this.#loadModules(
                this.config.aggregates,
                module => module instanceof Aggregate
            )
                .then(aggregates => this.#aggregateMap = Woltage.#constructAggregateMap(aggregates))
                .then(aggregateMap => Promise.all(
                    Object.values(aggregateMap)
                        .map(async ({snapshotter, options}) => {
                            snapshotter.configure(this.config.snapshots, options.snapshots);
                            if(snapshotter.config)
                                await snapshotter.setStore(createStore(
                                    snapshotter.config.store || this.config.internalStore,
                                    '_woltage_snapshots'
                                ));
                        })
                )),
            this.#loadModules(
                this.config.projectorClasses,
                module => module.prototype instanceof Projector
            )
                .then(projectorClasses => this.#projectorMap = Woltage.#constructProjectorMap(projectorClasses)),
            this.#loadModules(
                this.config.readModelClasses,
                module => module.prototype instanceof ReadModel
            )
                .then(readModelClasses => {
                    this.#readModelMap = Object.fromEntries(
                        readModelClasses
                            .map(ReadModelClass => [ReadModelClass.toString(), new (ReadModelClass as any)()])
                    );
                })
        ]);

        await this.#store.connect()
            .then(() => this.#loadProjections());
    }

    async #loadProjections() {
        const projectionMap = (await this.#store.tables.projections.get({id: 'status'}))?.map ?? {};
        await Promise.all(
            Object.entries(projectionMap)
                .map(async ([name, {activeVersion, versions}]) => {
                    await Promise.all(
                        Object.entries(versions)
                            .map(
                                async ([, {version, projectorName, projectorVersion, storeName}]) =>
                                    this.#projections.add(await this.#createProjection(name, version, projectorName, projectorVersion, storeName))
                            )
                    );
                    if(activeVersion !== undefined)
                        this.#projections.setActive(name, activeVersion, true);
                })
        );
    }

    async #saveProjections() {
        const map: z.infer<typeof internalConfigSchema['projections']['schema']['shape']['map']> = {};
        for(const projection of this.#projections.idMap.values())
        {
            map[projection.name] ??= {activeVersion: undefined, versions: {}};
            map[projection.name].versions[projection.version] = {
                projectionId: projection.id,
                name: projection.name,
                version: projection.version,
                projectorName: projection.projector.constructor.name,
                projectorVersion: projection.projector.constructor.version,
                storeName: projection.storeName ?? ''
            };
        }
        for(const projection of this.#projections.activeProjectionMap.values())
            map[projection.name].activeVersion = projection.version;
        await this.#store.tables.projections.set({id: 'status', map});
    }

    async #createProjection(projectionName: string, projectionVersion: number, projectorName: string, projectorVersion: number, storeName: string) {
        const projectionId = Projection.getId(projectionName, projectionVersion);
        if(this.#projections.get(projectionId))
            throw new ConflictError('Projection already exists');

        const ProjectorClass = this.#projectorMap[projectorName]?.[projectorVersion];
        if(!ProjectorClass)
            throw new NotFoundError(`Projector '${Projector.getDisplayName(projectorName, projectorVersion)}' not found`);
        const store = this.#getStore(storeName, projectionId);

        const projection = new Projection(
            this,
            this.#eventStore,
            projectionName,
            projectionVersion,
            ProjectorClass,
            store
        );
        projection.storeName = storeName;

        await store.connect();

        return projection;
    }

    /**
     * Adds a new projection.
     * @param projectionName
     * @param projectionVersion
     * @param projectorName
     * @param projectorVersion
     * @param storeName One of the keys of the config's `stores` property.
     */
    async addProjection(projectionName: string, projectionVersion: number, projectorName: string, projectorVersion: number, storeName: string) {
        const projection = await this.#createProjection(projectionName, projectionVersion, projectorName, projectorVersion, storeName);
        this.#projections.add(projection);
        await this.#saveProjections();
        return projection;
    }

    /**
     * Updates the active version of a projection name.
     * @param projectionName
     * @param projectionVersion
     * @param force You can not switch to a projection that is not tracking live events unless you set the optional `force` parameter to `true`.
     */
    async setProjectionActive(projectionName: string, projectionVersion: number, force = false) {
        this.#projections.setActive(projectionName, projectionVersion, force);
        await this.#saveProjections();
    }

    /**
     * Returns all registered projections.
     */
    getProjections() {
        return Object.fromEntries(this.#projections.idMap);
    }

    /**
     * Returns a specific projection or `undefined` if the projection does not exist.
     * @param projectionName
     * @param projectionVersion
     */
    getProjection(projectionName: string, projectionVersion: number) {
        return this.#projections.get(projectionName, projectionVersion);
    }

    /**
     * Removes a projection.
     * Removing a projection will not delete its data from the corresponding store.
     * @param projectionName
     * @param projectionVersion
     * @param force You can not remove a projection that is currently active unless you set the optional `force` parameter to `true`
     */
    async removeProjection(projectionName: string, projectionVersion: number, force = false) {
        await this.#projections.remove(projectionName, projectionVersion, force);
        await this.#saveProjections();
    }

    async #execute(routine: () => unknown, context?: Context) {
        return await executionStorage.run(
            {
                eventStore: this.#eventStore,
                readModelMap: this.#readModelMap,
                projectionMap: new Map(this.#projections.activeProjectionMap),
                context
            },
            routine
        );
    }

    /**
     * Executes a command.
     * The optional `context` will be passed to the command.
     */
    async executeCommand<TState, TPayload extends z.ZodType = any>(commandInfo: CommandInfo<TState, TPayload>, aggregateId: string, payload: any, context?: Context): Promise<void>
    async executeCommand(aggregate: Aggregate, aggregateId: string, commandName: string, payload: any, context?: Context): Promise<void>
    async executeCommand(aggregateType: string, aggregateId: string, commandName: string, payload: any, context?: Context): Promise<void>
    async executeCommand(aggregateType: string | Aggregate | CommandInfo<any>, aggregateId: string, commandName: string, payload: any, context?: any) {
        if(typeof aggregateType !== 'string')
        {
            if('aggregate' in aggregateType) // CommandInfo
            {
                const commandInfo = aggregateType;
                context = payload;
                payload = commandName;
                commandName = commandInfo.name;
                aggregateType = commandInfo.aggregate.type;
            }
            else // Aggregate
                aggregateType = aggregateType.type;
        }

        const aggregate = this.#aggregateMap[aggregateType];
        if(!aggregate)
            throw new NotFoundError(`Aggregate '${aggregateType}' not found.`);
        await this.#execute(() => aggregate.executeCommand(aggregateId, commandName, payload), context);
    }

    /**
     * Schedules a command for execution at a specific time.
     * The optional `context` will be passed to the command.
     *
     * For this to work a `scheduler` must be provided via config.
     */
    async scheduleCommand<TState, TPayload extends z.ZodType = any>(executeAt: Date, commandInfo: CommandInfo<TState, TPayload>, aggregateId: string, payload: any, context?: Context): Promise<void>
    async scheduleCommand(executeAt: Date, aggregate: Aggregate, aggregateId: string, commandName: string, payload: any, context?: Context): Promise<void>
    async scheduleCommand(executeAt: Date, aggregateType: string, aggregateId: string, commandName: string, payload: any, context?: Context): Promise<void>
    async scheduleCommand(executeAt: Date, aggregateType: string | Aggregate | CommandInfo<any>, aggregateId: string, commandName: string, payload: any, context?: any) {
        if(!this.#commandScheduler)
            throw new Error('No scheduler provided. Define a scheduler in the config to use \'scheduleCommand\'.');

        if(typeof aggregateType !== 'string')
        {
            if('aggregate' in aggregateType) // CommandInfo
            {
                const commandInfo = aggregateType;
                context = payload;
                payload = commandName;
                commandName = commandInfo.name;
                aggregateType = commandInfo.aggregate.type;
            }
            else // Aggregate
                aggregateType = aggregateType.type;
        }
        await this.#commandScheduler.schedule(executeAt, [
            aggregateType,
            aggregateId,
            commandName,
            payload,
            context
        ]);
    }

    /**
     * Returns the result of the corresponding read model handler.
     * The optional `context` will be passed to the handler.
     */
    async executeQuery<
        TClass extends typeof ReadModel,
        THandler extends keyof InstanceType<TClass>
    >(
        readModel: TClass,
        handlerName: THandler,
        query: InstanceType<TClass>[THandler] extends (...args: any) => any ? Parameters<InstanceType<TClass>[THandler]>[0] : never,
        context?: Context
    ): Promise<InstanceType<TClass>[THandler] extends (...args: any) => any ? ReturnType<InstanceType<TClass>[THandler]> : never>;
    async executeQuery(readModelName: string, handlerName: string, query: any, context?: Context): Promise<unknown>;
    async executeQuery(readModelName: typeof ReadModel | string, handlerName: string, query: any, context?: any) {
        if(typeof readModelName !== 'string')
            readModelName = readModelName.toString();
        const readModel = this.#readModelMap[ReadModel.getName(readModelName)];
        if(!readModel)
            throw new NotFoundError(`Read model '${readModelName}' not found.`);
        return await this.#execute(() => readModel.call(handlerName, query), context);
    }

    /**
     * Runs a function within a projection context and returns the function's return value.
     * @param triggerEvent The event that acts as the trigger for the side effect.
     * @param callback The function to execute.
     * @param args Optional arguments to pass to the function.
     */
    executeAsSideEffect<R, TArgs extends any[]>(triggerEvent: Event, callback: (...args: TArgs) => R, ...args: TArgs): R {
        return projectionStorage.run({
            isReplaying: false,
            currentEvent: triggerEvent,
            woltage: this,
            eventStore: this.#eventStore
        }, callback, ...args);
    }

    /**
     * Starts the application.
     */
    async start() {
        await this.#eventStore.connect();
        await this.#projections.init();
        await this.#commandScheduler?.start();
    }

    /**
     * Gracefully stops the application.
     */
    async stop() {
        await this.#commandScheduler?.stop();
        await this.#projections.stop();
        await this.#eventStore.close();
    }
}

export type {Woltage};

export default Woltage.create.bind(Woltage);
