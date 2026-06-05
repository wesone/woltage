import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import z from 'zod';
import ReadModel from '../../src/read/ReadModel.ts';
import mockExecutionContext from '../_mock/mockExecutionContext.ts';
import {mockProjection} from '../_mock/ProjectionMock.ts';

class TestProjection extends ReadModel {
    projectionName = 'test-projection';

    async greet(query: {name: string}) {
        return `Hello ${query.name}`;
    }

    async find(query: {key: string}) {
        return query.key;
    }
}

await describe('ReadModel', async () => {
    await describe('get', async () => {
        it('throws if called outside execution context', () => {
            assert.throws(() => TestProjection.get());
        });

        it('throws if instance not found in readModelMap', () => {
            mockExecutionContext({readModelMap: {}});
            assert.throws(() => TestProjection.get());

            const instance = new TestProjection();
            mockExecutionContext({readModelMap: {[TestProjection.toString()]: instance}});

            assert.doesNotThrow(() => TestProjection.get());
            assert.strictEqual(TestProjection.get(), instance);
        });
    });

    await describe('store getter', async () => {
        const instance = new TestProjection();

        it('throws if projectionMap missing', () => {
            assert.throws(() => instance.store);
        });

        it('throws if projection not found', () => {
            mockExecutionContext({projectionMap: new Map()});
            assert.throws(() => instance.store);
        });

        await it('returns correct projector store', async () => {
            const projectionMock = await mockProjection('p1', 1);
            const projectionMap = new Map([[instance.projectionName, projectionMock]]);
            mockExecutionContext({projectionMap});

            assert.strictEqual(instance.store, projectionMock.projector.store);
        });
    });

    await it('tables getter returns correct tables', async () => {
        const instance = new TestProjection();
        const projectionMock = await mockProjection('p1', 1);
        const projectionMap = new Map([[instance.projectionName, projectionMock]]);
        mockExecutionContext({projectionMap});

        assert.strictEqual(instance.tables, projectionMock.projector.store.tables);
    });

    await describe('call', async () => {
        const instance = new TestProjection();
        mockExecutionContext({
            readModelMap: {[TestProjection.toString()]: instance}
        });

        await it('executes handler correctly', async () => {
            const result = await instance.call('greet', {name: 'Alice'});
            assert.strictEqual(result, 'Hello Alice');
        });

        await it('throws if handler not found', async () => {
            await assert.rejects(instance.call('unknownHandler', {}));
        });

        await it('handles schema validation', async () => {
            const instance = new TestProjection();
            mockExecutionContext({
                readModelMap: {[TestProjection.toString()]: instance}
            });
            instance.schemaRegistry.find = z.object({key: z.string()});

            await assert.rejects(instance.call('find', {key: 1}));
            await assert.doesNotReject(instance.call('find', {key: ''}));
        });
    });
});
