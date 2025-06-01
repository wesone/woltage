import type Event from '../Event.ts';
import EventRegistry from '../EventRegistry.ts';
import emit from '../write/emit.ts';
import type {IStore, TableDefinitionMap} from '../adapters/Store.ts';

class Projector<Definitions extends TableDefinitionMap>
{
    declare ['constructor']: typeof Projector;

    static schema: TableDefinitionMap;
    static version: number;

    #registry: EventRegistry;
    readonly store: IStore<Definitions>;
    readonly emit = emit;

    constructor(store: IStore) {
        if(!typeof this.constructor.schema)
            throw new Error('Projector\'s schema property is invalid.');
        if(typeof this.constructor.version !== 'number' || this.constructor.version <= 0)
            throw new Error('Projector\'s version property must be a number > 0.');

        this.#registry = new EventRegistry(this, this.constructor.prototype);
        this.store = store;
        this.store.defineTables(this.constructor.schema as Definitions);
    }

    get types() {
        return this.#registry.types;
    }

    async onEvent(e: Event) {
        const {event, handler} = await this.#registry.get(e);
        await handler?.(event);
    }
}

export default Projector;
