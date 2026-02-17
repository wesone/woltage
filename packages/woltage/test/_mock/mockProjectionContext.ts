import {mock} from 'node:test';
import {projectionStorage, type ProjectionContext} from '../../src/localStorages.ts';
import type {Woltage} from '../../src/Woltage.ts';
import eventStore from './eventStore.ts';
import mockEventClass from './mockEventClass.ts';

export default (store: Partial<ProjectionContext>) => {
    projectionStorage.enterWith({
        isReplaying: false,
        currentEvent: new (mockEventClass('Mocked'))({
            aggregateId: 'MockedAggregate',
            payload: {}
        }),
        woltage: {
            executeCommand: mock.fn(),
            scheduleCommand: mock.fn()
        } as unknown as Woltage,
        eventStore,
        ...store
    });
};
