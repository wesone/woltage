import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import ProjectionMap from '../src/ProjectionMap.ts';
import ProjectionMock, {mockProjection} from './_mock/ProjectionMock.ts';

await describe('ProjectionMap', async () => {
    await describe('add', async () => {
        await it('works and get by id or name/version returns added projection', async () => {
            const pm = new ProjectionMap();
            const p = new ProjectionMock('proj', 1);
            await pm.add(p);

            assert.strictEqual(pm.get(p.id), p);
            assert.strictEqual(pm.get('proj', 1), p);
        });

        await it('will call projection init when projection map init was already called', async () => {
            const pm = new ProjectionMap();
            const p1 = new ProjectionMock('proj', 1);
            const p2 = new ProjectionMock('proj', 2);

            await pm.add(p1);
            assert.throws(() => pm.setActive('proj', 1));

            await pm.init();
            await pm.add(p2);
            assert.doesNotThrow(() => pm.setActive('proj', 2));
        });
    });

    await describe('setActive', async () => {
        await it('throws for unknown projections', async () => {
            const pm = new ProjectionMap();
            assert.throws(() => pm.setActive('proj', 1));
        });

        await it('sets active projection and toggles previous active', async () => {
            const pm = new ProjectionMap();
            const p1 = await mockProjection('proj', 1);
            const p2 = await mockProjection('proj', 2);
            await pm.add(p1);
            await pm.add(p2);

            pm.setActive('proj', 1);
            assert.strictEqual(pm.getActive('proj'), p1);
            assert.strictEqual(p1.isActive, true);
            assert.strictEqual(p2.isActive, false);

            pm.setActive('proj', 2);
            assert.strictEqual(pm.getActive('proj'), p2);
            assert.strictEqual(p1.isActive, false);
            assert.strictEqual(p2.isActive, true);
        });

        await it('sets active projection that is not tracking live events with "force: true"', async () => {
            const pm = new ProjectionMap();
            const p = new ProjectionMock('proj', 1);
            await pm.add(p);

            assert.throws(() => pm.setActive('proj', 1));
            assert.strictEqual(pm.getActive('proj'), undefined);

            assert.doesNotThrow(() => pm.setActive('proj', 1, true));
            assert.strictEqual(pm.getActive('proj'), p);
        });
    });

    await describe('remove', async () => {
        await it('does not throw for unknown projections', async () => {
            const pm = new ProjectionMap();
            await assert.doesNotReject(async () => pm.remove('proj', 1));
        });

        await it('throws when removing active projection without "force" and removes with "force: true"', async () => {
            const pm = new ProjectionMap();
            const p = await mockProjection('proj', 1);
            await pm.add(p);
            pm.setActive('proj', 1);

            await assert.rejects(async () => pm.remove('proj', 1));
            await assert.rejects(async () => pm.remove('proj', 1, false));

            await assert.doesNotReject(async () => pm.remove('proj', 1, true));
            assert.strictEqual(pm.get('proj', 1), undefined);
            assert.strictEqual(pm.getActive('proj'), undefined);
            assert.strictEqual(p.stopCalled, true);
        });
    });

    await it('init calls init on all projections and stop calls stop', async () => {
        const pm = new ProjectionMap();
        const p1 = new ProjectionMock('a', 1);
        const p2 = new ProjectionMock('b', 1);
        await pm.add(p1);
        await pm.add(p2);

        await pm.init();
        assert.strictEqual(pm.isRunning, true);
        assert.strictEqual(p1.initCalled, true);
        assert.strictEqual(p2.initCalled, true);

        await pm.stop();
        assert.strictEqual(pm.isRunning, false);
        assert.strictEqual(p1.stopCalled, true);
        assert.strictEqual(p2.stopCalled, true);
    });

    await it('getActiveProjections returns cached snapshot and invalidates on mutation', async () => {
        const pm = new ProjectionMap();
        const p1 = await mockProjection('x', 1);
        const p2 = await mockProjection('y', 1);
        await pm.add(p1);
        await pm.add(p2);

        pm.setActive('x', 1);
        const s1 = pm.getActiveProjections();
        const s2 = pm.getActiveProjections();
        // same snapshot reference when unchanged
        assert.strictEqual(s1, s2);

        // mutate active projections
        pm.setActive('y', 1);
        const s3 = pm.getActiveProjections();
        assert.notStrictEqual(s1, s3);
    });
});
