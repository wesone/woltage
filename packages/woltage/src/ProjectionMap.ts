import Projection from './read/Projection.ts';

export default class ProjectionMap
{
    idMap: Map<string, Projection> = new Map();
    activeProjectionMap: Map<string, Projection> = new Map();
    isRunning = false;

    async add(projection: Projection) {
        this.idMap.set(projection.id, projection);
        if(this.isRunning)
            await projection.init();
    }

    setActive(projectionName: string, projectionVersion: number, force = false) {
        const projectionId = Projection.getId(projectionName, projectionVersion);
        if(!this.idMap.has(projectionId))
            throw new Error(`Unknown projection '${Projection.getDisplayName(projectionName, projectionVersion)}'`);
        const projection = this.idMap.get(projectionId)!;
        if(!projection.isLiveTracking && !force)
            throw new Error(`Projection '${projection.getDisplayName()}' is not tracking live events.`);

        const activeProjection = this.activeProjectionMap.get(projectionName);
        if(activeProjection)
            activeProjection.isActive = false;
        projection.isActive = true;
        this.activeProjectionMap.set(projectionName, projection);
    }

    getActive(projectionName: string) {
        return this.activeProjectionMap.get(projectionName);
    }

    get(projectionId: string): Projection | undefined;
    get(projectionName: string, projectionVersion: number): Projection | undefined;
    get(nameOrId: string, projectionVersion?: number): Projection | undefined {
        const projectionId = typeof projectionVersion !== 'number'
            ? nameOrId
            : Projection.getId(nameOrId, projectionVersion);
        return this.idMap.get(projectionId);
    }

    async remove(projectionName: string, projectionVersion: number, force = false) {
        const projection = this.get(projectionName, projectionVersion);
        if(!projection)
            return;

        const isActive = this.getActive(projectionName) === projection;
        if(isActive)
        {
            if(!force)
                throw new Error(`Can't remove active projection '${projection.getDisplayName()}'.`);
            this.activeProjectionMap.delete(projectionName);
        }

        await projection.stop();
        this.idMap.delete(projection.id);
    }

    async init() {
        this.isRunning = true;
        await Promise.all([...this.idMap.values()].map(projection => projection.init()));
    }

    async stop() {
        this.isRunning = false;
        await Promise.all([...this.idMap.values()].map(projection => projection.stop()));
    }
}
