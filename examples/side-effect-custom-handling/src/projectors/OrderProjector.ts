import {Projector, z} from 'woltage';
import OrderPlaced from '../events/order/OrderPlaced.ts';
import OrderShipped from '../events/order/OrderShipped.ts';
import shipOrder from '../sideEffects/shipOrder.ts';

const schema = {
    orders: {
        key: z.object({
            orderId: z.string()
        }),
        schema: z.object({
            customerId: z.string(),
            total: z.number(),
            currency: z.enum(['USD', 'EUR']),
            deliveryAddress: z.object({
                street: z.string(),
                houseNumber: z.string(),
                postalCode: z.string(),
                city: z.string()
            }),
            shippingCompany: z.enum(['FedEx', 'UPS', 'USPS', 'DHL']).optional(),
            trackingNumber: z.string().optional()
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

        await this.store.tables.orders.set({orderId: event.aggregateId, ...event.payload});
        await shipOrder(event);
    }

    async [OrderShipped.identity](event: OrderShipped) {
        await this.store.tables.orders.update({orderId: event.aggregateId}, event.payload);
    }
}
