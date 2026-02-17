import {getProjectionContext, sideEffect, type SideEffectFunction} from 'woltage';
import SideEffectHelper from './SideEffectHelper.ts';

function getCallerPath()
{
    const originalPST = Error.prepareStackTrace;

    let file;
    try
    {
        const err = new Error();
        Error.prepareStackTrace = function pst(err, stack) { return stack; };
        const stack = (err.stack ?? []) as NodeJS.CallSite[];
        const currentFile = stack.shift()?.getFileName();
        while(stack.length)
        {
            file = stack.shift()?.getFileName();
            if(file !== currentFile)
                break;
        }
    }
    // catch(e)
    // {
    //     // ignore
    // }
    finally
    {
        Error.prepareStackTrace = originalPST;
        if(!file)
            return null;
        return file;
    }
}

export default function customSideEffect<TArgs extends any[]>(fn: SideEffectFunction<TArgs>)
{
    // The idea is to associate the desired side effect function
    // with an identifier that is consistent between application restarts.
    // This way we can separate the "calling" of the side effect and the actual "execution".
    //
    // The benefit is more control of the execution.
    // We can store the side effect calls and execute them later, implement a retry mechanism with an
    // exponential backoff, a general error event and so on.

    const origin = getCallerPath();
    if(!origin)
        throw new Error('Could not register side effect (unknown file).');

    SideEffectHelper.register(origin, fn);

    return sideEffect(
        (...args: TArgs) => {
            SideEffectHelper.queue({
                origin,
                event: getProjectionContext().currentEvent,
                args,
                try: 0
            });
        }
    );
}
