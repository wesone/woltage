import A from './_Aggregate.ts';
import {NotFoundError, ForbiddenError} from 'woltage';
import OrderAcceptedByRestaurant from '../../events/OrderAcceptedByRestaurant.ts';

export default A.registerCommand(
    OrderAcceptedByRestaurant.schema,
    async function accept(state, payload) {
        if(!state.placedAt)
            throw new NotFoundError();

        if(state.canceled)
            throw new ForbiddenError('Order was canceled.');

        if(!state.accepted)
            return new OrderAcceptedByRestaurant({payload});
    }
);

