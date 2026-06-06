import ReadModel from '../../src/read/ReadModel.ts';
import type {StandardSchemaV1} from '../../src/adapters/standard-schema.ts';

class ReadModelMock extends ReadModel
{
    projectionName = 'test-projection';
    schemaRegistry: Partial<Record<string, StandardSchemaV1>> = {};
}

export default ReadModelMock;

export function mockReadModel<
    T extends Record<string,(...args: any[]) => any> = Record<string, () => unknown>
>(
    handlers?: T,
    schemaRegistry?: Record<keyof T, StandardSchemaV1>
)
{
    const readModelMock = new ReadModelMock();
    if(schemaRegistry)
        readModelMock.schemaRegistry = schemaRegistry;
    return Object.assign(readModelMock, handlers ?? {}) as ReadModel & T;
}
