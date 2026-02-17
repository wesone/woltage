import {projectionStorage, readContext} from '../localStorages.ts';

/**
 * Returns the current projection context.
 * Throws if no projection context is available.
 */
export default function getProjectionContext()
{
    const {
        isReplaying,
        currentEvent,
        woltage
    } = readContext(projectionStorage);

    return {
        isReplaying,
        currentEvent,
        woltage
    };
}
