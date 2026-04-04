import type {StandardSchemaV1} from './standard-schema.ts';

export type TableDefinition<T extends StandardSchemaV1<object, any> = StandardSchemaV1<object, any>> = {
    key: T,
    schema?: T
};
export type TableDefinitionMap<T extends StandardSchemaV1<object, any> = StandardSchemaV1<object, any>> = Record<string, TableDefinition<T>>;

export type TableKey<Def extends TableDefinition> = StandardSchemaV1.InferOutput<Def['key']>;
export type TableEntry<Def extends TableDefinition> = StandardSchemaV1.InferOutput<Def['schema'] extends StandardSchemaV1<object> ? Def['key'] & Def['schema'] : Def['key']>;
export type TablePartialEntry<Def extends TableDefinition> = Def['schema'] extends StandardSchemaV1<object> ? Partial<StandardSchemaV1.InferOutput<Def['schema']>> : never;

export interface ITable<Def extends TableDefinition> {
    set(entry: TableEntry<Def>): Promise<void>
    get(key: TableKey<Def>): Promise<TableEntry<Def> | null>
    update(key: TableKey<Def>, values: TablePartialEntry<Def>): Promise<void>
    remove(key: TableKey<Def>): Promise<void>
};

export type TableMap<Definitions extends TableDefinitionMap> = {[K in keyof Definitions]: ITable<Definitions[K]>;};

export interface IStore<Definitions extends TableDefinitionMap = any> {
    prefix: string;
    tables: TableMap<Definitions>;

    connect(): Promise<void>
    close(force?: boolean): Promise<void>

    defineTables(tables: Definitions): void
};
