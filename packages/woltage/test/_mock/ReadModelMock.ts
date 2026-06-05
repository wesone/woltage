import ReadModel from '../../src/read/ReadModel.ts';

class ReadModelMock extends ReadModel
{
    projectionName = 'test-projection';
}

export default ReadModelMock;

export async function mockReadModel<
    T extends Record<string,(...args: any[]) => any> = Record<string, () => unknown>
>(
    handlers?: T
)
{
    return Object.assign(new ReadModelMock(), handlers ?? {}) as ReadModel & T;
}
