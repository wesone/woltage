import {AsyncLocalStorage} from 'node:async_hooks';
import type Event from './Event.ts';
import type {IEventStore} from './adapters/EventStore.ts';
import type ReadModel from './read/ReadModel.ts';
import type ProjectionMap from './ProjectionMap.ts';

export function readStore<T>(asyncLocalStorage: AsyncLocalStorage<T>)
{
    const store = asyncLocalStorage.getStore();
    if(store === undefined)
        throw new Error('AsyncLocalStorage not available. Make sure to run this code within an AsyncLocalStorage context.');
    return store;
}

type ProjectionStore = {
    isReplaying: boolean,
    currentEvent: Event,
    eventStore: IEventStore
};
export const projectionStorage = new AsyncLocalStorage<ProjectionStore>();

type ExecutionStore = {
    eventStore: IEventStore,
    readModelMap: Record<string, ReadModel>,
    projectionMap: ProjectionMap['activeProjectionMap'],
    context?: any
};
export const executionStorage = new AsyncLocalStorage<ExecutionStore>();
