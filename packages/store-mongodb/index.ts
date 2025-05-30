import {Collection, Db, Filter, MongoClient, type MongoClientOptions} from 'mongodb';
import type {IStore, DefinitionMap, Definition, ITable, TableEntry, TableKey, TablePartialEntry} from 'woltage';

class Table<Def extends Definition> implements ITable<Def> {
    collection: Collection<TableEntry<Def>>;
    definition: Def;

    constructor(db: Db, name: string, definition: Def) {
        this.collection = db.collection(name);
        this.definition = definition;
    }

    async set(entry: TableEntry<Def>) {
        await this.collection.updateOne(this.definition.key.parse(entry), {$set: entry}, {upsert: true});
    }

    get(key: TableKey<Def>) {
        return this.collection.findOne(key, {projection: {_id: 0}});
    }

    async update(key: TableKey<Def>, values: TablePartialEntry<Def>) {
        await this.collection.updateOne(key, {$set: values});
    }

    async remove(key: TableKey<Def>) {
        await this.collection.deleteOne(key);
    }

    async find(query: Filter<TableEntry<Def>>) {
        return await this.collection.find(query, {projection: {_id: 0}}).toArray();
    }
}

export default class MongoDBStore<Definitions extends DefinitionMap> implements IStore {
    prefix: string;
    tables!: { [K in keyof Definitions]: Table<Definitions[K]>; };
    #client: MongoClient;
    #db: Db;

    constructor(prefix: string, url: string, options?: MongoClientOptions) {
        this.prefix = prefix;
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
                        definition as Definitions[keyof Definition]
                    )])
            )
        );
    }
}
