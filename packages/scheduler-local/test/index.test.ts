import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import LocalScheduler from '../index.ts';

describe('LocalScheduler', () => {
    it('calls subscriber for a scheduled job', async () => {
        const calls: Array<{executeAt: number, data: unknown}> = [];
        const scheduler = new LocalScheduler();
        await scheduler.subscribe((executeAt, data) => {
            calls.push({executeAt: executeAt.getTime(), data});
        });

        await scheduler.schedule(new Date(Date.now() + 10), {foo: 'bar'});

        await new Promise(r => setTimeout(r, 20));
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(calls[0].data, {foo: 'bar'});
    });

    it('executes multiple invocations in chronological order', async () => {
        const ordered: number[] = [];
        const scheduler = new LocalScheduler();
        await scheduler.subscribe(executeAt => {
            ordered.push(executeAt.getTime());
        });

        const base = Date.now();
        await scheduler.schedule(new Date(base + 50), 'second');
        await scheduler.schedule(new Date(base + 10), 'first');

        await new Promise(r => setTimeout(r, 60));
        assert.strictEqual(ordered.length, 2);
        assert.ok(ordered[0] < ordered[1], 'first scheduled job should run before second');
    });

    it('retries failed invocations when retryFailedInvocations is \'true\'', async () => {
        const simulatedFailureCount = 4;
        let count = 0;
        const scheduler = new LocalScheduler({retryFailedInvocations: true});
        await scheduler.subscribe(async () => {
            count++;
            if(count < simulatedFailureCount)
                throw new Error('simulated failure');
            // succeed on retry
        });

        await scheduler.schedule(new Date(Date.now() + 10), null);

        await new Promise(r => setTimeout(r, 50));
        assert.strictEqual(count, simulatedFailureCount);
    });

    it('retries failed invocations when retryFailedInvocations is set (number)', async () => {
        let count = 0;
        const scheduler = new LocalScheduler({retryFailedInvocations: 2});
        await scheduler.subscribe(async () => {
            count++;
            if(count < 2)
                throw new Error('simulated failure');
            // succeed on retry
        });

        await scheduler.schedule(new Date(Date.now() + 10), null);

        await new Promise(r => setTimeout(r, 60));
        assert.strictEqual(count, 2, 'should attempt twice (initial + one retry)');
    });

    it('does not execute callback if callback was unsubscribed', async () => {
        const calls: Array<{executeAt: number, data: unknown}> = [];
        const callback = (executeAt: Date, data: unknown) => {
            calls.push({executeAt: executeAt.getTime(), data});
        };
        const scheduler = new LocalScheduler();
        await scheduler.subscribe(callback);
        scheduler.unsubscribe(callback);

        await scheduler.schedule(new Date(Date.now() + 10), {foo: 'bar'});

        await new Promise(r => setTimeout(r, 20));
        assert.strictEqual(calls.length, 0);
    });
});
