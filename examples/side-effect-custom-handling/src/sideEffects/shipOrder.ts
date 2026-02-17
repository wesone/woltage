import {emit} from 'woltage';
import type OrderPlaced from '../events/order/OrderPlaced.ts';
import sideEffect from '../sideEffect.ts';
import OrderShipped from '../events/order/OrderShipped.ts';
import OrderAggregate from '../aggregates/order/_Aggregate.ts';

// This simulates a third party API.
// It will throw an exception for demo purposes.
const shippingProvider = (() => {
    let simulatedFailures = 0;
    return async () => {
        if(simulatedFailures < 2)
        {
            simulatedFailures++;
            throw new Error('Random error.');
        }
        const companies = Object.values(OrderShipped.schema.shape.shippingCompany.enum);
        return {
            shippingCompany: companies[Math.floor(Math.random() * companies.length)],
            trackingNumber: Math.random() < .5 ? Math.random().toString() : undefined
        };
    };
})();

export default sideEffect(
    async (event: OrderPlaced) => {
        await emit(OrderAggregate.type, new OrderShipped({
            aggregateId: event.aggregateId,
            payload: await shippingProvider()
        }));
        console.log('Side effect executed successfully for', event.aggregateId);
    }
);
