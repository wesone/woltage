import type {
    IStore,
    TableDefinitionMap,
    TableDefinition,
    ITable,
    TableEntry,
    TableKey,
    TablePartialEntry
} from 'woltage';
import {z, validate} from 'woltage';
import {Pool, type PoolConfig, type PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';

const dbStorage = new AsyncLocalStorage<{
    client: PoolClient
}>();

class Table<Def extends TableDefinition<z.ZodObject>> implements ITable<Def> {
    #store;
    name;
    definition;
    escapedName;
    primaryKeys;

    constructor(store: PostgreSQLStore<{[name: string]: Def}>, name: string, definition: Def) {
        this.#store = store;
        this.name = name;
        this.definition = definition;
        this.escapedName = this.#store.escapeField(this.name);
        this.primaryKeys = Object.keys(this.definition.key.shape).map(this.#store.escapeField);
    }

    async #getKey(key: TableKey<Def>) {
        // strip properties that are not part of the key
        return await validate(this.definition.key, key) as TableKey<Def>;
    }

    async set(entry: TableEntry<Def>) {
        await this.#store.query(`
            INSERT INTO ${this.escapedName}(${Object.keys(entry).map(this.#store.escapeField).join(', ')}) 
            VALUES(${Object.keys(entry).map((k, i) => `$${i + 1}`).join(', ')})
            ON CONFLICT (${this.primaryKeys.join(', ')}) 
            DO UPDATE SET ${Object.keys(entry).map((k, i) => `${this.#store.escapeField(k)} = $${i + 1}`).join(', ')};
        `, Object.values(entry));
    }

    async get(key: TableKey<Def>) {
        key = await this.#getKey(key);
        const result = await this.#store.query(`
            SELECT * FROM ${this.escapedName}
            WHERE ${Object.keys(key).map((k, i) => `${this.#store.escapeField(k)} = $${i + 1}`).join(' AND ')};
        `, Object.values(key));
        return (result.rows[0] ?? null) as TableEntry<Def> | null;
    }

    async update(key: TableKey<Def>, updateValues: TablePartialEntry<Def>) {
        key = await this.#getKey(key);
        const values = Object.values(updateValues);
        await this.#store.query(`
            UPDATE ${this.escapedName}
            SET ${Object.keys(updateValues).map((k, i) => `${this.#store.escapeField(k)} = $${i + 1}`).join(', ')}
            WHERE ${Object.keys(key).map((k, i) => `${this.#store.escapeField(k)} = $${values.length + i + 1}`).join(' AND ')};
        `, [...values, Object.values(key)]);
    }

    async remove(key: TableKey<Def>) {
        key = await this.#getKey(key);
        await this.#store.query(`
            DELETE FROM ${this.escapedName}
            WHERE ${Object.keys(key).map((k, i) => `${this.#store.escapeField(k)} = $${i + 1}`).join(' AND ')};
        `, Object.values(key));
    }
}

type AdapterConfig = {
    createTables?: boolean
};

export default class PostgreSQLStore<TableDefinitions extends TableDefinitionMap<z.ZodObject>> implements IStore<TableDefinitions> {
    prefix = '';
    tables = {} as {[K in keyof TableDefinitions]: Table<TableDefinitions[K]>};
    #pool: Pool;
    #config: AdapterConfig;

    constructor(pgConfig?: PoolConfig, adapterConfig?: AdapterConfig) {
        this.#pool = new Pool(pgConfig);
        this.#pool.on('error', err => {
            console.error('Unexpected PostgreSQL error on idle client', err);
        });

        this.#config = {
            createTables: true,
            ...adapterConfig
        };
    }

    async connect() {
        if(this.#config.createTables)
            await this.#initTables();
    }

    async close() {
        await this.#pool.end();
    }

    defineTables(tables: Partial<TableDefinitions>) {
        this.tables = Object.assign(
            this.tables ?? {},
            Object.fromEntries(
                Object.entries(tables)
                    .map(([name, definition]) => {
                        if(
                            !(definition.key instanceof z.ZodObject)
                            || definition.schema && !(definition.schema instanceof z.ZodObject)
                        )
                            throw new Error('This adapter is only compatible with Zod schemas.');
                        return [
                            name,
                            new Table(
                                this,
                                `${this.prefix}_${name}`,
                                definition as TableDefinitions[keyof TableDefinition]
                            )
                        ];
                    })
            )
        );
    }

    get query() {
        const {client} = dbStorage.getStore() ?? {client: this.#pool};
        return client.query.bind(client);
    }

    async transaction(routine: (client: PoolClient) => unknown) {
        const client = await this.#pool.connect();
        try
        {
            await client.query('BEGIN');
            await dbStorage.run({client}, () => routine(client));
            await client.query('COMMIT');
        }
        catch(e)
        {
            await client.query('ROLLBACK');
            throw e;
        }
        finally
        {
            client.release();
        }
    }

    escapeField(field: string) {
        return `"${field}"`;
    }

    #generateFieldsFromSchema(tableName: string, columns: Record<string, z.ZodType>) {
        return Object.entries(columns).map(([columnName, type]) => {
            const fieldDefinition = [];
            const fieldInfo = {
                required: true,
                default: undefined as unknown
            };

            while(
                [
                    z.ZodOptional.prototype,
                    z.ZodNullable.prototype,
                    z.ZodDefault.prototype
                ].includes(Object.getPrototypeOf(type))
            )
            {
                if(type instanceof z.ZodOptional || type instanceof z.ZodNullable)
                {
                    fieldInfo.required = false;
                    type = type.unwrap() as z.ZodType;
                }

                if(type instanceof z.ZodDefault)
                {
                    fieldInfo.default = typeof type.def.defaultValue === 'string'
                        ? `'${type.def.defaultValue}'`
                        : type.def.defaultValue;
                    type = type.unwrap() as z.ZodType;
                }
            }

            if(fieldInfo.required)
                fieldDefinition.push('NOT NULL');
            if(fieldInfo.default !== undefined)
                fieldDefinition.push(`DEFAULT ${fieldInfo.default}`);

            const formatMap = {
                safeint: 'int4',
                uuid: 'uuid'
            };
            const typeMap = {
                boolean: 'bool',
                date: 'date',
                number: 'float8', // 'numeric'
                int: 'int4',
                bigint: 'int8',
                string: 'text', // 'varchar'
                object: 'jsonb'
            };

            const fieldType = type.meta()?.dataType
                ?? formatMap[(type.def as z.ZodString).format as keyof typeof formatMap]
                ?? typeMap[type.def.type as keyof typeof typeMap];
            if(fieldType === undefined)
                throw new Error(`Unhandled schema type '${type.def.type}' for column '${columnName}' while creating table '${tableName}'.`);

            fieldDefinition.unshift(`${this.escapeField(columnName)} ${fieldType}`);
            return fieldDefinition.join(' ');
        });
    }

    async #initTables() {
        const client = await this.#pool.connect();
        for(const [, {name, definition, escapedName, primaryKeys}] of Object.entries<Table<TableDefinitions[keyof TableDefinitions]>>(this.tables))
        {
            const fields = this.#generateFieldsFromSchema(name, {
                ...definition.key.shape,
                ...(definition.schema?.shape ?? {})
            });
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${escapedName} (
                    ${fields.join(', ')}
                    , PRIMARY KEY (${primaryKeys.join(', ')})
                );
            `);
        }
        client.release();
    }
}
