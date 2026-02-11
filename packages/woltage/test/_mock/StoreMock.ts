import {type Mock, mock} from 'node:test';
import type {IStore, ITable, TableDefinition, TableEntry, TableKey, TablePartialEntry, TableDefinitionMap} from '../../src/adapters/Store';

class TableMock<Def extends TableDefinition> implements ITable<Def> {
    name: string;
    definition: Def;
    records = {} as Record<string, TableEntry<Def>>;

    set: Mock<ITable<Def>['set']>;
    get: Mock<ITable<Def>['get']>;
    update: Mock<ITable<Def>['update']>;
    remove: Mock<ITable<Def>['remove']>;

    constructor(name: string, definition: Def) {
        this.name = name;
        this.definition = definition;

        this.set = mock.fn(
            (entry: TableEntry<Def>) => {
                this.records[this.#generateKey(entry)] = entry;
                return Promise.resolve();
            }
        );
        this.get = mock.fn(
            (key: TableKey<Def>) => Promise.resolve(this.records[this.#generateKey(key)] ?? null)
        );
        this.update = mock.fn(
            async (key: TableKey<Def>, values: TablePartialEntry<Def>) => {
                const entry = await this.get(key);
                if(entry === null)
                    return;
                await this.set({...entry, ...values});
            }
        );
        this.remove = mock.fn(
            (key: TableKey<Def>) => {
                delete this.records[this.#generateKey(key)];
                return Promise.resolve();
            }
        );
    }

    #serialize(value: any) {
        return JSON.stringify(value, (k, v) => typeof v === 'bigint' ? `${v.toString()}n` : v);
    }

    #generateKey(tableKey: TableKey<Def>) {
        const key = this.definition.key.parse(tableKey);
        return this.#serialize(
            Object.fromEntries(
                Object.entries(key)
                    .sort(([key1], [key2]) => key1.localeCompare(key2))
            )
        );
    }
}

class StoreMock<Definitions extends TableDefinitionMap> implements IStore
{
    prefix = '';
    tables = {} as { [K in keyof Definitions]: TableMock<Definitions[K]>; };

    connect: Mock<IStore['connect']>;
    close: Mock<IStore['close']>;
    defineTables: Mock<IStore['defineTables']>;

    constructor() {
        this.connect = mock.fn(
            () => Promise.resolve()
        );
        this.close = mock.fn(
            () => Promise.resolve()
        );
        this.defineTables = mock.fn(
            (tables: Record<keyof Definitions, Definitions[keyof Definitions]>) => {
                this.tables = Object.assign(
                    this.tables ?? {},
                    Object.fromEntries(
                        Object.entries(tables)
                            .map(([name, definition]) => [name, new TableMock(`${this.prefix}_${name}`, definition)])
                    )
                );
            }
        );
    }

    clear() {
        Object.values(this.tables).forEach(table => {
            table.records = {};
        });
    }
}

export default StoreMock;
