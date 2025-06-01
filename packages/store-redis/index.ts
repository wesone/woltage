import type {IStore, TableDefinitionMap, TableDefinition, ITable, TableEntry, TableKey, TablePartialEntry} from 'woltage';
import {createClient, type RedisClientOptions} from 'redis';

class Table<Def extends TableDefinition> implements ITable<Def> {
    name: string;
    definition: Def;
    client: ReturnType<typeof createClient>;

    constructor(name: string, definition: Def, client: ReturnType<typeof createClient>) {
        this.name = name;
        this.definition = definition;
        this.client = client;

        return new Proxy(this, {
            get(target, prop, receiver) {
                const ownProperty = Reflect.get(target, prop, receiver);
                if(ownProperty !== undefined)
                    return ownProperty;
                return Reflect.get(target.client, prop, receiver);
            }
        });
    }

    #serialize(value: any) {
        return JSON.stringify(value, (k, v) => typeof v === 'bigint' ? `${v.toString()}n` : v);
    }

    #deserialize(value: string) {
        // return JSON.parse(value, (k, v) => {
        //     if(typeof v === 'string' && /^\d+n$/.test(v))
        //         return BigInt(v.slice(0, -1));
        //     return v;
        // });

        // slightly faster without regex
        return JSON.parse(value, (k, v) => {
            if(typeof v === 'string' && v.endsWith('n'))
            {
                const numberPart = v.slice(0, -1);
                if(!isNaN(parseInt(numberPart)))
                    return BigInt(numberPart);
            }
            return v;
        });
    }

    #generateKey(tableKey: TableKey<Def>) {
        const key = this.definition.key.parse(tableKey); // strip other possible properties that do not belong to the key
        return this.#serialize(
            Object.fromEntries(
                Object.entries(key)
                    .sort(([key1], [key2]) => key1.localeCompare(key2))
            )
        );
    }

    async set(entry: TableEntry<Def>) {
        await this.client.HSET(this.name, this.#generateKey(entry), this.#serialize(entry));
    }

    async get(key: TableKey<Def>) {
        const value = await this.client.HGET(this.name, this.#generateKey(key));
        if(value === null)
            return value;
        return this.#deserialize(value) as TableEntry<Def>;
    }

    async update(key: TableKey<Def>, values: TablePartialEntry<Def>) {
        const entry = await this.get(key);
        if(entry === null)
            return;

        // deep update?
        // {a: 42, b: {x: 1, y: 2}} update {a: 21, b: {x: 4}} => {a: 21, b: {x: 4, y: 2}}
        // or shallow update?
        // {a: 42, b: {x: 1, y: 2}} update {a: 21, b: {x: 4}} => {a: 21, b: {x: 4}}
        const newEntry = Object.assign({}, entry, values);

        await this.set(newEntry);
    }

    async remove(key: TableKey<Def>): Promise<void> {
        await this.client.HDEL(this.name, this.#generateKey(key));
    }
}

export default class RedisStore<Definitions extends TableDefinitionMap> implements IStore {
    prefix: string;
    tables!: { [K in keyof Definitions]: Table<Definitions[K]> & ReturnType<typeof createClient>; };
    #client: ReturnType<typeof createClient>;

    constructor(prefix: string, clientOptions: RedisClientOptions) {
        this.prefix = prefix;
        this.#client = createClient(clientOptions)
            .on('error', (err: any) => console.log('Redis Client Error', err));
    }

    async connect() {
        await this.#client.connect();
    }

    async close(force = false) {
        if(force)
        {
            this.#client.destroy();
            return;
        }
        await this.#client.close();
    }

    defineTables(tables: Record<keyof Definitions, Definitions[keyof Definitions]>) {
        this.tables = Object.assign(
            this.tables ?? {},
            Object.fromEntries(
                Object.entries(tables)
                    .map(([name, definition]) => [name, new Table(`${this.prefix}_${name}`, definition, this.#client)])
            )
        );
    }
}
