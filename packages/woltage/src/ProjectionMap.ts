import Projection from './read/Projection.ts';

export default class ProjectionMap
{
    idMap: Map<string, Projection> = new Map();
    activeProjectionMap: Map<string, Projection> = new Map();

    add(projection: Projection) {
        this.idMap.set(projection.id, projection);
    }

    setActive(projectionName: string, projectionVersion: number, force = false) {
        const projectionId = Projection.getId(projectionName, projectionVersion);
        if(!this.idMap.has(projectionId))
            throw new Error(`Unknown projection '${projectionName}@${projectionVersion}'`);
        const projection = this.idMap.get(projectionId)!;
        if(!projection.isLiveTracking && !force)
            throw new Error(`Projection '${projectionName}@${projectionVersion}' is not tracking live events.`);
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
        if(!force && isActive)
            throw new Error(`Can not remove active projection '${projectionName}@${projectionVersion}'.`);

        await projection.stop();
        this.idMap.delete(projection.id);
        if(isActive)
            this.activeProjectionMap.delete(projectionName);
    }

    async init() {
        await Promise.all([...this.idMap.values()].map(projection => projection.init()));
    }

    async stop() {
        await Promise.all([...this.idMap.values()].map(projection => projection.stop()));
    }
}
