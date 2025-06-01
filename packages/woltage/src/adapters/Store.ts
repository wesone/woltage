import type {z} from 'zod/v4';

export type TableDefinition = {
    key: z.ZodObject<any>,
    schema?: z.ZodObject<any>
};
export type TableDefinitionMap = Record<string, TableDefinition>;

export type TableKey<Def extends TableDefinition> = z.infer<Def['key']>;
export type TableEntry<Def extends TableDefinition> = z.infer<Def['schema'] extends z.ZodObject<any> ? Def['key'] & Def['schema'] : Def['key']>;
export type TablePartialEntry<Def extends TableDefinition> = Def['schema'] extends z.ZodObject<any> ? Partial<z.infer<Def['schema']>> : never;

export interface ITable<Def extends TableDefinition> {
    set(entry: TableEntry<Def>): Promise<void>
    get(key: TableKey<Def>): Promise<TableEntry<Def> | null>
    update(key: TableKey<Def>, values: TablePartialEntry<Def>): Promise<void>
    remove(key: TableKey<Def>): Promise<void>
};

export type TableMap<Definitions extends TableDefinitionMap> = {[K in keyof Definitions]: ITable<Definitions[K]>;};
// export type TableMap<Definitions extends TableDefinitionMap, TTable extends ITable<any> = ITable<any>> = {[K in keyof Definitions]: TTable<Definitions[K]>;}

export interface IStore<Definitions extends TableDefinitionMap = any> {
    prefix: string;
    tables: TableMap<Definitions>;

    connect(): Promise<void>
    close(force?: boolean): Promise<void>

    defineTables(tables: Definitions): void
};
