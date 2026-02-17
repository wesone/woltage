import sideEffect from './sideEffect.ts';
import type {Woltage} from '../Woltage.ts';
import {readContext, projectionStorage} from '../localStorages.ts';

export default sideEffect(
    (...args: Parameters<Woltage['executeCommand']>) =>
        readContext(projectionStorage).woltage.executeCommand(...args)
) as Woltage['executeCommand'];
