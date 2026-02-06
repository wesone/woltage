import sideEffect from './sideEffect.ts';
import type {Woltage} from '../Woltage.ts';
import {readStore, projectionStorage} from '../localStorages.ts';

export default sideEffect(
    (...args: Parameters<Woltage['scheduleCommand']>) =>
        readStore(projectionStorage).scheduleCommand(...args)
) as Woltage['scheduleCommand'];
