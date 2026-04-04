import {projectionStorage} from '../localStorages.ts';

export type SideEffectFunction<TArgs extends any[] = any[], TReturn extends (void | Promise<void>) = void | Promise<void>> = (...args: TArgs) => TReturn;

export default function sideEffect<TArgs extends any[], TReturn extends(void | Promise<void>)>(fn: SideEffectFunction<TArgs, TReturn>): SideEffectFunction<TArgs, Promise<void>>
{
    return async (...args) => {
        const store = projectionStorage.getStore();
        if(store === undefined)
            console.trace(`Invalid side effect execution "${fn.toString()}".`, 'Executing side effects is only possible within a projection context.');
        else if(
            store.isReplaying === false
            && (!store.projection || store.projection.isActive)
        )
            await fn(...args);
        return Promise.resolve();
    };
}
