import type {z} from 'zod/v4';

export type Definition = {
    key: z.ZodObject<any>,
    schema?: z.ZodObject<any>
};
export type DefinitionMap = Record<string, Definition>;

export type TableKey<Def extends Definition> = z.infer<Def['key']>;
export type TableEntry<Def extends Definition> = z.infer<Def['schema'] extends z.ZodObject<any> ? Def['key'] & Def['schema'] : Def['key']>;
export type TablePartialEntry<Def extends Definition> = Def['schema'] extends z.ZodObject<any> ? Partial<z.infer<Def['schema']>> : never;

export interface ITable<Def extends Definition> {
    set(entry: TableEntry<Def>): Promise<void>
    get(key: TableKey<Def>): Promise<TableEntry<Def> | null>
    update(key: TableKey<Def>, values: TablePartialEntry<Def>): Promise<void>
    remove(key: TableKey<Def>): Promise<void>
};

export type TableList<Definitions extends DefinitionMap> = {[K in keyof Definitions]: ITable<Definitions[K]>;};
// export type TableList<Definitions extends DefinitionMap, TTable extends ITable<any> = ITable<any>> = {[K in keyof Definitions]: TTable<Definitions[K]>;}

export interface IStore<Definitions extends DefinitionMap = any> {
    prefix: string;
    tables: TableList<Definitions>;

    connect(): Promise<void>
    close(force?: boolean): Promise<void>

    defineTables(tables: Definitions): void
};
