import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import executeCommand from '../../src/sideEffects/executeCommand.ts';
import mockProjectionContext from '../_mock/mockProjectionContext.ts';
import Aggregate from '../../src/write/Aggregate.ts';

await describe('executeCommand', async () => {
    const aggregate = Aggregate.create('test', {});
    const commandInfo = aggregate.registerCommand(function doSomething() {});
    const aggregateId = 'aggregateId1';

    await it('does not throw if called within a projection context', async () => {
        mockProjectionContext({isReplaying: false});
        await assert.doesNotReject(() => executeCommand(commandInfo, aggregateId, {}));
    });
});
