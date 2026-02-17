import {AsyncLocalStorage} from 'node:async_hooks';
import type Event from './Event.ts';
import type {IEventStore} from './adapters/EventStore.ts';
import type Projection from './read/Projection.ts';
import type ReadModel from './read/ReadModel.ts';
import type ProjectionMap from './ProjectionMap.ts';
import type {Context, Woltage} from './Woltage.ts';

export function readContext<T>(contextStorage: AsyncLocalStorage<T>)
{
    const store = contextStorage.getStore();
    if(store === undefined)
        throw new Error('Context not available. Make sure to run this code within a context.');
    return store;
}

export type ProjectionContext = {
    isReplaying: boolean,
    currentEvent: Event,
    woltage: Woltage,
    eventStore: IEventStore,
    projection?: Projection
};

export const projectionStorage = new AsyncLocalStorage<ProjectionContext>();

export type ExecutionContext = {
    eventStore: IEventStore,
    readModelMap: Record<string, ReadModel>,
    projectionMap: ProjectionMap['activeProjectionMap'],
    context?: Context
};

export const executionStorage = new AsyncLocalStorage<ExecutionContext>();
