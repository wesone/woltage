import {projectionStorage} from '../localStorages.ts';

type SideEffectFn<TArg> = (arg: TArg) => void | Promise<void>;

export default function sideEffect<TArg>(fn: SideEffectFn<TArg>): SideEffectFn<TArg>
{
    return async arg => {
        const store = projectionStorage.getStore();
        if(store === undefined)
            console.trace(`Invalid side effect execution "${fn.toString()}".`, 'Executing side effects is only possible from event handlers in projections.');
        else if(store.isReplaying === false)
            await fn(arg);
        return Promise.resolve();
    };
}
