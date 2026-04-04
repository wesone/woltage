import Projection from './read/Projection.ts';

export default class ProjectionMap
{
    idMap = new Map<string, Projection>();
    activeProjections = new Map<string, Projection>();
    isRunning = false;

    #activeProjectionsGen = 0;
    #activeProjectionsSnapshot: typeof this.activeProjections | null = null;
    #activeProjectionsSnapshotGen = -1;

    async add(projection: Projection) {
        this.idMap.set(projection.id, projection);
        if(this.isRunning)
            await projection.init();
    }

    setActive(projectionName: string, projectionVersion: number, force = false) {
        const projectionId = Projection.getId(projectionName, projectionVersion);

        const projection = this.idMap.get(projectionId);
        if(!projection)
            throw new Error(`Unknown projection '${Projection.getDisplayName(projectionName, projectionVersion)}'`);
        if(!projection.isLiveTracking && !force)
            throw new Error(`Projection '${projection.getDisplayName()}' is not tracking live events.`);

        const activeProjection = this.activeProjections.get(projectionName);
        if(activeProjection)
            activeProjection.isActive = false;
        projection.isActive = true;

        this.activeProjections.set(projectionName, projection);
        this.#activeProjectionsGen++;
    }

    getActive(projectionName: string) {
        return this.activeProjections.get(projectionName);
    }

    get(projectionId: string): Projection | undefined;
    get(projectionName: string, projectionVersion: number): Projection | undefined;
    get(nameOrId: string, projectionVersion?: number) {
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

            this.activeProjections.delete(projectionName);
            this.#activeProjectionsGen++;
        }

        // If the projection was not active, it could still be used by a long running process,
        // that got the reference from getActiveProjections()...
        //
        // setActive('projectionName', 1);
        // const snapshot = getActiveProjections();
        // const promise = longRunningProcess(snapshot);
        // setActive('projectionName', 2);
        // remove('projectionName', 1); // will stop projectionName@1 but longRunningProcess could still use it
        // await promise;
        //
        // Maybe we should detect if it's safe to stop the projection.
        // Everything that relies on GC (e.g. WeakRef, FinalizationRegistry, ...) should be avoided.

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

    getActiveProjections() {
        if(this.#activeProjectionsSnapshotGen !== this.#activeProjectionsGen || this.#activeProjectionsSnapshot === null)
        {
            this.#activeProjectionsSnapshot = new Map(this.activeProjections);
            this.#activeProjectionsSnapshotGen = this.#activeProjectionsGen;
        }
        return this.#activeProjectionsSnapshot;
    }
}
