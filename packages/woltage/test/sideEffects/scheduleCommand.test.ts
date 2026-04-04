import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import scheduleCommand from '../../src/sideEffects/scheduleCommand.ts';
import mockProjectionContext from '../_mock/mockProjectionContext.ts';
import Aggregate from '../../src/write/Aggregate.ts';

await describe('scheduleCommand', async () => {
    const aggregate = Aggregate.create('test', {});
    const commandInfo = aggregate.registerCommand(function doSomething() {});
    const aggregateId = 'aggregateId1';

    await it('does not throw if called within a projection context', async () => {
        mockProjectionContext({isReplaying: false});
        await assert.doesNotReject(() => scheduleCommand(new Date(), commandInfo, aggregateId, {}));
    });
});
