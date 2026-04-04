import type {Woltage} from 'woltage';
import OrderProjector from './projectors/OrderProjector.ts';
import place from './aggregates/order/place.ts';
import accept from './aggregates/order/accept.ts';

export default async (woltage: Woltage) => {
    // Add default projection
    await woltage.addProjection('orders', 1, OrderProjector.name, OrderProjector.version, 'mongo', true);

    // Schedule some commands
    // "order-2" will be automatically canceled after 1 minute because it won't be accepted by the restaurant.
    // See OrderProjector.ts for the logic that schedules the cancelIfNotAccepted command
    await Promise.all([
        woltage.scheduleCommand(
            new Date(Date.now() + 2000),
            place,
            'order-1',
            {
                customerId: 'customer-1',
                restaurantId: 'restaurant-1',
                food: 'Pizza',
                total: 4.2
            }
        ),
        woltage.scheduleCommand(
            new Date(Date.now() + 1000),
            place,
            'order-2',
            {
                customerId: 'customer-2',
                restaurantId: 'restaurant-1',
                food: 'Pasta',
                total: 4.2
            }
        ),
        woltage.scheduleCommand(
            new Date(Date.now() + 1000 * 10),
            accept,
            'order-1',
            {expectedPreperationTime: 45}
        )
    ]);
};
