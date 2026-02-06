import {projectionStorage} from '../localStorages.ts';

type SideEffectFn<TArgs extends any[]> = (...args: TArgs) => void | Promise<void>;

export default function sideEffect<TArgs extends any[]>(fn: SideEffectFn<TArgs>): SideEffectFn<TArgs>
{
    return async (...args) => {
        const store = projectionStorage.getStore();
        if(store === undefined)
            console.trace(`Invalid side effect execution "${fn.toString()}".`, 'Executing side effects is only possible from event handlers in projections.');
        else if(store.isReplaying === false)
            //TODO allow custom sideEffect executor to handle retries and failure
            await fn(...args);
        return Promise.resolve();
    };
}
