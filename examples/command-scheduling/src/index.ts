import createWoltage from 'woltage';
import {eventStore, stores, scheduler} from './adapters.ts';
import place from './aggregates/order/place.ts';
import accept from './aggregates/order/accept.ts';

// init woltage
const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores,
    scheduler
});

await woltage.addProjection('orders', 1, 'OrderProjector', 1, 'mongo')
    .then(() => woltage.setProjectionActive('orders', 1, true))
    .catch(() => {});

await Promise.all([
    woltage.scheduleCommand(
        new Date(Date.now() + 2000),
        place,
        'order-1',
        {
            customerId: 'customer-1',
            restraurantId: 'restaurant-1',
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
            restraurantId: 'restaurant-1',
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

// handle a shut down
[
    'SIGTERM',
    'SIGINT',
    'SIGUSR2'
].forEach(type => {
    process.once(type, async () => {
        try
        {
            await woltage.stop();
            console.log('Application was gracefully shut down...');
        }
        finally
        {
            process.kill(process.pid, type);
        }
    });
});
