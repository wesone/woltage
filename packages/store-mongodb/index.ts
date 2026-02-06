import type {
    IStore,
    TableDefinitionMap,
    TableDefinition,
    ITable,
    TableEntry,
    TableKey,
    TablePartialEntry
} from 'woltage';
import {
    Collection,
    Db,
    MongoClient,
    type MongoClientOptions,
    type Filter
} from 'mongodb';

class Table<Def extends TableDefinition> implements ITable<Def> {
    collection: Collection<TableEntry<Def>>;
    definition: Def;

    constructor(db: Db, name: string, definition: Def) {
        this.collection = db.collection(name);
        this.definition = definition;

        return new Proxy(this, {
            get(target, prop, receiver) {
                const ownProperty = Reflect.get(target, prop, receiver);
                const property = ownProperty ?? Reflect.get(target.collection, prop, receiver);
                if(typeof property === 'function')
                    return property.bind(ownProperty !== undefined ? target : target.collection);
                return property;
            }
        });
    }

    #getKey(key: TableKey<Def>) {
        // strip properties that are not part of the key
        return this.definition.key.parse(key) as TableKey<Def>;
    }

    async set(entry: TableEntry<Def>) {
        await this.collection.updateOne(this.#getKey(entry) as Filter<TableEntry<Def>>, {$set: entry}, {upsert: true});
    }

    get(key: TableKey<Def>) {
        return this.collection.findOne(this.#getKey(key) as Filter<TableKey<Def>>, {projection: {_id: 0}}) as Promise<TableEntry<Def> | null>;
    }

    async update(key: TableKey<Def>, values: TablePartialEntry<Def>) {
        await this.collection.updateOne(this.#getKey(key) as Filter<TableKey<Def>>, {$set: values});
    }

    async remove(key: TableKey<Def>) {
        await this.collection.deleteOne(this.#getKey(key) as Filter<TableKey<Def>>);
    }
}

export default class MongoDBStore<Definitions extends TableDefinitionMap> implements IStore {
    prefix = '';
    tables = {} as { [K in keyof Definitions]: Table<Definitions[K]> & Collection<TableEntry<Definitions[K]>>; };
    #client: MongoClient;
    #db: Db;

    constructor(url: string, options?: MongoClientOptions) {
        this.#client = new MongoClient(url, options);
        this.#db = this.#client.db();
    }

    async connect() {
        await this.#client.connect();
    }

    async close(force = false) {
        await this.#client.close(force);
    }

    defineTables(tables: any) {
        this.tables = Object.assign(
            this.tables ?? {},
            Object.fromEntries(
                Object.entries(tables)
                    .map(([name, definition]) => [name, new Table(
                        this.#db,
                        `${this.prefix}_${name}`,
                        definition as Definitions[keyof TableDefinition]
                    )])
            )
        );
    }
}
