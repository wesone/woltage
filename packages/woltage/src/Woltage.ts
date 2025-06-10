import fs from 'node:fs/promises';
import path from 'node:path';

import Aggregate from './write/Aggregate.ts';
import EventStore from './EventStore.ts';
import Event from './Event.ts';
import {registerEventClasses} from './eventMap.ts';
import Projector from './read/Projector.ts';
import type {IStore} from './adapters/Store.ts';
import {z} from 'zod/v4';
import {createStore, createStoreFactory} from './StoreFactory.ts';
import Projection from './read/Projection.ts';
import ConflictError from './errors/ConflictError.ts';
import ProjectionMap from './ProjectionMap.ts';
import ReadModel from './read/ReadModel.ts';
import NotFoundError from './errors/NotFoundError.ts';
import {executionStorage} from './localStorages.ts';
import {WoltageConfig} from './WoltageConfig.ts';

export type AggregateMap = {[aggregateName: string]: Aggregate};

export type ProjectorMap = {
    [projectorName: string]: {
        [version: number]: typeof Projector
    }
};

const projectionConfigSchema = {
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
                            storeName: z.string(),
                        })
                    )
                })
            )
        })
    }
};

class Woltage
{
    static async #importModules(dirPath: string, filter: (module: any) => boolean) {
        const modules: any[] = [];
        await Promise.all(
            (await fs.readdir(dirPath, {withFileTypes: true, recursive: true}))
                .filter(dirent => dirent.isFile() && ['ts', 'js'].includes(dirent.name.split('.').pop() ?? ''))
                .map(async dirent => {
                    const {default: module} = await import(path.join(dirent.parentPath, dirent.name));
                    if(filter(module))
                        modules.push(module);
                })
        );
        return modules;
    }

    static #constructAggregateMap(aggregates: Aggregate[]) {
        return aggregates.reduce((map, aggregate) => {
            if(map[aggregate.name])
                throw new Error(`Duplicate aggregate found. Aggregate '${aggregate.name}' already exists.`);
            map[aggregate.name] = aggregate;
            return map;
        }, {} as AggregateMap);
    }

    static #constructProjectorMap(projectorClasses: (typeof Projector)[]) {
        return projectorClasses.reduce((map, ProjectorClass) => {
            map[ProjectorClass.name] ??= {};
            if(map[ProjectorClass.name][ProjectorClass.version])
                throw new Error(`Duplicate projector class found. Projector '${ProjectorClass.name}@${ProjectorClass.version}' already exists.`);
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

    config: WoltageConfig;
    #aggregateMap: AggregateMap = {};
    #projectorMap: ProjectorMap = {};
    #readModelMap: Record<string, ReadModel> = {};
    #store: IStore<typeof projectionConfigSchema>;
    #getStore: ReturnType<typeof createStoreFactory>;
    #projections: ProjectionMap;

    constructor(config: WoltageConfig) {
        this.config = config;

        this.#store = createStore(this.config.internalStore, '_woltage_config');
        this.#store.defineTables(projectionConfigSchema);

        this.#getStore = createStoreFactory(this.config.stores ?? {});

        this.#projections = new ProjectionMap();
    }

    async #init() {
        registerEventClasses(
            typeof this.config.eventClasses === 'string'
                ? await Woltage.#importModules(this.config.eventClasses, module => module.prototype instanceof Event)
                : this.config.eventClasses
        );

        this.#aggregateMap = Woltage.#constructAggregateMap(
            typeof this.config.aggregates === 'string'
                ? await Woltage.#importModules(this.config.aggregates, module => module instanceof Aggregate)
                : this.config.aggregates
        );

        this.#projectorMap = Woltage.#constructProjectorMap(
            typeof this.config.projectorClasses === 'string'
                ? await Woltage.#importModules(this.config.projectorClasses, module => module.prototype instanceof Projector)
                : this.config.projectorClasses
        );

        this.#readModelMap = Object.fromEntries(
            (
                typeof this.config.readModelClasses === 'string'
                    ? await Woltage.#importModules(this.config.readModelClasses, module => module.prototype instanceof ReadModel)
                    : this.config.readModelClasses ?? []
            )
                .map(ReadModelClass => [ReadModelClass.toString(), new ReadModelClass()])
        );

        await this.#store.connect();

        await this.#loadProjections();
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
        const map: z.infer<typeof projectionConfigSchema['projections']['schema']['shape']['map']> = {};
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
            throw new NotFoundError(`Projector '${projectorName}@${projectorVersion}' not found`);
        const store = this.#getStore(storeName, projectionId);

        const projection = new Projection(projectionName, projectionVersion, ProjectorClass, store);
        projection.storeName = storeName;

        await store.connect();

        return projection;
    }

    async addProjection(projectionName: string, projectionVersion: number, projectorName: string, projectorVersion: number, storeName: string) {
        const projection = await this.#createProjection(projectionName, projectionVersion, projectorName, projectorVersion, storeName);
        this.#projections.add(projection);
        await this.#saveProjections();
    }

    async setProjectionActive(projectionName: string, projectionVersion: number, force = false) {
        this.#projections.setActive(projectionName, projectionVersion, force);
        await this.#saveProjections();
    }

    getProjections() {
        return Object.fromEntries(this.#projections.idMap);
    }

    getProjection(projectionName: string, projectionVersion: number) {
        return this.#projections.get(projectionName, projectionVersion);
    }

    async removeProjection(projectionName: string, projectionVersion: number, force = false) {
        await this.#projections.remove(projectionName, projectionVersion, force);
        await this.#saveProjections();
    }

    async #execute(routine: () => unknown, context?: any) {
        return await executionStorage.run(
            {
                readModelMap: this.#readModelMap,
                projectionMap: new Map(this.#projections.activeProjectionMap),
                context
            },
            routine
        );
    }

    async executeCommand(aggregateName: string, aggregateId: string, commandName: string, payload: any, context?: any) {
        const aggregate = this.#aggregateMap[aggregateName];
        if(!aggregate)
            throw new NotFoundError(`Aggregate '${aggregateName}' not found.`);
        await this.#execute(() => aggregate.executeCommand(aggregateId, commandName, payload), context);
    }

    async executeQuery<
        TClass extends typeof ReadModel,
        THandler extends keyof InstanceType<TClass>
    >(
        readModel: TClass,
        handlerName: THandler,
        query: InstanceType<TClass>[THandler] extends (...args: any) => any ? Parameters<InstanceType<TClass>[THandler]>[0] : any,
        context?: any
    ): Promise<InstanceType<TClass>[THandler] extends (...args: any) => any ? ReturnType<InstanceType<TClass>[THandler]> : InstanceType<TClass>[THandler]>;
    async executeQuery(readModelName: string, handlerName: string, query: any, context?: any): Promise<unknown>;
    async executeQuery(readModelName: any, handlerName: string, query: any, context?: any) {
        if(typeof readModelName !== 'string')
            readModelName = readModelName.toString();
        const readModel = this.#readModelMap[ReadModel.getName(readModelName)];
        if(!readModel)
            throw new NotFoundError(`Read model '${readModelName}' not found.`);
        return await this.#execute(() => readModel.call(handlerName, query), context);
    }

    async start() {
        await EventStore.init(new this.config.eventStore.adapter(...(this.config.eventStore.args ?? [])));
        await this.#projections.init();
    }

    async stop() {
        await this.#projections.stop();
        await EventStore.close();
    }
}

export type {Woltage};

export default Woltage.create.bind(Woltage);
