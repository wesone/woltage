import A from './_Aggregate.ts';
import {NotFoundError} from 'woltage';
import OrderCanceled from '../../events/OrderCanceled.ts';

export default A.registerCommand(
    async function cancelIfNotAccepted({placedAt, accepted}) {
        if(!placedAt)
            throw new NotFoundError();

        if(accepted)
            return;

        return new OrderCanceled({payload: {reason: 'timeout'}});
    }
);
