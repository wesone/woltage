import {Projector, z} from 'woltage';
import OrderPlaced from '../events/OrderPlaced.ts';
import OrderAcceptedByRestaurant from '../events/OrderAcceptedByRestaurant.ts';
import OrderCanceled from '../events/OrderCanceled.ts';
import cancelIfNotAccepted from '../aggregates/order/cancelIfNotAccepted.ts';

const schema = {
    orders: {
        key: z.object({
            orderId: z.string()
        }),
        schema: z.object({
            customerId: z.string(),
            restraurantId: z.string(),
            food: z.string(),
            total: z.number(),
            status: z.string()
        })
    }
};

export default class OrderProjector extends Projector<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;

    async [OrderPlaced.identity](event: OrderPlaced) {
        const order = await this.store.tables.orders.get({orderId: event.aggregateId});
        if(order)
            return;

        await this.store.tables.orders.set({
            orderId: event.aggregateId,
            ...event.payload,
            status: 'placed'
        });

        // cancel order if not accepted within 1 minute
        await this.scheduleCommand(
            new Date(Date.now() + 1000 * 60),
            cancelIfNotAccepted,
            event.aggregateId,
            null
        );

        console.log(`Order ${event.aggregateId} was placed`);
    }

    async [OrderAcceptedByRestaurant.identity](event: OrderAcceptedByRestaurant) {
        await this.store.tables.orders.update({orderId: event.aggregateId}, {status: 'accepted'});
        console.log(`Order ${event.aggregateId} was accepted`);
    }

    async [OrderCanceled.identity](event: OrderCanceled) {
        await this.store.tables.orders.update({orderId: event.aggregateId}, {status: 'canceled'});
        console.log(`Order ${event.aggregateId} was canceled. Reason: ${event.payload.reason}`);
    }
}
