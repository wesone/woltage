import A from './_Aggregate.ts';
import {DuplicateAggregateError} from 'woltage';
import OrderPlaced from '../../events/order/OrderPlaced.ts';

export default A.registerCommand(
    OrderPlaced.schema,
    async function place({placedAt}, payload) {
        if(placedAt)
            throw new DuplicateAggregateError();

        return new OrderPlaced({payload});
    }
);
