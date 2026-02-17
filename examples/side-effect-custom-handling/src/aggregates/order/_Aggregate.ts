import {Aggregate} from 'woltage';
import OrderPlaced from '../../events/order/OrderPlaced.ts';
import OrderShipped from '../../events/order/OrderShipped.ts';

export default Aggregate.create('order', {
    $init() {
        return {
            placedAt: null as Date | null,
            shippedAt: null as Date | null
        };
    },
    [OrderPlaced.identity](state, event: OrderPlaced) {
        return {
            ...state,
            placedAt: event.timestamp
        };
    },
    [OrderShipped.identity](state, event: OrderShipped) {
        return {
            ...state,
            shippedAt: event.timestamp
        };
    }
});
