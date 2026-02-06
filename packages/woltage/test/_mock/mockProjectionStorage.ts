import {mock} from 'node:test';
import {projectionStorage, type ProjectionStore} from '../../src/localStorages.ts';
import eventStore from './eventStore.ts';
import mockEventClass from './mockEventClass.ts';

export default (store: Partial<ProjectionStore>) => {
    projectionStorage.enterWith({
        isReplaying: false,
        currentEvent: new (mockEventClass('Mocked'))({
            aggregateId: 'MockedAggregate',
            payload: {}
        }),
        eventStore,
        scheduleCommand: mock.fn(),
        ...store
    });
};
