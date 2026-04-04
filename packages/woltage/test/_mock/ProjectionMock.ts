import Projection from '../../src/read/Projection.ts';
import Projector from '../../src/read/Projector.ts';
import type {Woltage} from '../../src/Woltage.ts';
import eventStore from './eventStoreMock.ts';
import StoreMock from './StoreMock.ts';

class ProjectorMock extends Projector
{
    static schema = {};
    static version = 1;
}

class ProjectionMock extends Projection
{
    initCalled = false;
    stopCalled = false;

    constructor(name: string, version: number) {
        super(
            {
                config: {}
            } as unknown as Woltage,
            eventStore,
            name,
            version,
            ProjectorMock,
            new StoreMock()
        );
    }

    async init() {
        await super.init();
        this.initCalled = true;
    }

    async stop() {
        await super.stop();
        this.stopCalled = true;
    }

    getDisplayName() {
        return `${this.name}@${this.version}`;
    }
}

export default ProjectionMock;

export async function mockProjection(...args: ConstructorParameters<typeof ProjectionMock>)
{
    const projection = new ProjectionMock(...args);
    await projection.init();
    return projection;
}
