import {executionStorage, type ExecutionContext} from '../../src/localStorages.ts';
import eventStore from './eventStoreMock.ts';

export default (store: Partial<ExecutionContext>) => {
    const fullStore = {
        eventStore,
        readModelMap: {},
        projectionMap: new Map(),
        context: undefined,
        pluginRegistry: undefined,
        ...store
    };
    executionStorage.enterWith(fullStore);
    return fullStore as ExecutionContext & {eventStore: typeof eventStore};
};
