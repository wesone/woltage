import {z} from 'zod/v4';
import type Projector from './Projector.ts';
import {projectionStorage} from '../localStorages.ts';
import Event from '../Event.ts';
import EventStore from '../EventStore.ts';
import type {IStore} from '../adapters/Store.ts';
import {START, SubscriptionStream} from '../adapters/EventStore.ts';

const configPrefix = '_woltage';

const configDefinition = {
    [configPrefix]: {
        key: z.object({
            projectionId: z.string()
        }),
        schema: z.object({
            position: z.bigint()
        })
    }
};

class Projection
{
    static getId(name: string, version: number) {
        return `${name}-${version}`;
    }

    readonly id: string;
    readonly name: string;
    readonly version: number;
    storeName?: string;
    projector: Projector<typeof configDefinition>;
    #isReplaying: boolean = true;
    #isLiveTracking: boolean = false;
    #latestPosition: bigint = -1n;
    #subscription?: SubscriptionStream;

    constructor(name: string, version: number, ProjectorClass: typeof Projector, store: IStore<typeof configDefinition>) {
        this.id = Projection.getId(name, version);
        this.name = name;
        this.version = version;

        store.defineTables(configDefinition);
        this.projector = new ProjectorClass(store);
    }

    get isReplaying() {
        return this.#isReplaying;
    }

    get isLiveTracking() {
        return this.#isLiveTracking;
    }

    async init() {
        const filter = {types: this.projector.types};

        this.#latestPosition = await EventStore.getLatestPosition(filter) ?? -1n;
        const startPosition = (await this.projector.store.tables[configPrefix].get({projectionId: this.id}))?.position;
        // if stored position is same as latestPosition update isReplaying and isLiveTracking immediately
        if(startPosition && startPosition >= this.#latestPosition || this.#latestPosition < 0n)
            this.#onReplayed();

        this.#subscription = EventStore.subscribe({
            fromRevision: startPosition ?? START,
            filter
        });
        this.#subscription.on('data', async event => {
            this.#subscription?.pause();
            this.#updatePosition(event.position);
            await this.onEvent(event);
            this.#subscription?.resume();
        });
    }

    #onReplayed() {
        this.#isReplaying = false;
        this.#isLiveTracking = true;
    }

    #updatePosition(currentPosition: bigint) {
        if(currentPosition > this.#latestPosition)
        {
            this.#latestPosition = currentPosition;
            if(this.isReplaying)
                this.#onReplayed();
        }
    }

    async onEvent(event: Event) {
        //TODO handle errors and retry do not kill the application
        await projectionStorage.run(
            {isReplaying: this.isReplaying, currentEvent: event},
            () => this.projector.onEvent(event)
        );
        // if the framework should handle idempotency, we would need to update the projection and save the handled position transactionally
        await this.projector.store.tables[configPrefix].set({projectionId: this.id, position: event.position});
    }

    async stop() {
        this.#subscription?.destroy();
        await this.projector.store.close();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            version: this.version,
            storeName: this.storeName,
            isReplaying: this.#isReplaying,
            isLiveTracking: this.#isLiveTracking,
            latestPosition: this.#latestPosition.toString() + 'n',
            projector:  {
                name: this.projector.constructor.name,
                version: this.projector.constructor.version
            }
        };
    }
}

export default Projection;
