import {Aggregate} from 'woltage';
import OrderPlaced from '../../events/OrderPlaced.ts';
import OrderAcceptedByRestaurant from '../../events/OrderAcceptedByRestaurant.ts';
import OrderCanceled from '../../events/OrderCanceled.ts';

export default Aggregate.create('order', {
    $init() {
        return {
            placedAt: null as Date | null,
            accepted: false,
            canceled: false
        };
    },
    [OrderPlaced.identity](state, event: OrderPlaced) {
        return {
            ...state,
            placedAt: event.timestamp
        };
    },
    [OrderAcceptedByRestaurant.identity](state) {
        if(state.canceled)
            return state;
        return {
            ...state,
            accepted: true
        };
    },
    [OrderCanceled.identity](state) {
        return {
            ...state,
            accepted: false,
            canceled: true
        };
    }
});
