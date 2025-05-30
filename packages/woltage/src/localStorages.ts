import {AsyncLocalStorage} from 'node:async_hooks';
import Event from './Event.ts';
import type ProjectionMap from './ProjectionMap.ts';
import type ReadModel from './read/ReadModel.ts';

type ProjectionStore = {
    isReplaying: boolean,
    currentEvent: Event
};
export const projectionStorage = new AsyncLocalStorage<ProjectionStore>();

type ExecutionStore = {
    readModelMap: Record<string, ReadModel>,
    projectionMap: ProjectionMap['activeProjectionMap'],
    context?: any
};
export const executionStorage = new AsyncLocalStorage<ExecutionStore>();
