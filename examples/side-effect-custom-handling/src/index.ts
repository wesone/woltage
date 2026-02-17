import createWoltage, {DuplicateAggregateError} from 'woltage';
import {eventStore, stores} from './adapters.ts';
import SideEffectHelper from './SideEffectHelper.ts';
import place from './aggregates/order/place.ts';
import Order from './readModels/Order.ts';

// init woltage
const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores,
    autostart: false
});

await woltage.addProjection('orders', 1, 'OrderProjector', 1, 'mongo')
    .then(() => woltage.setProjectionActive('orders', 1, true))
    .catch(() => {});

await SideEffectHelper.init(woltage);

await woltage.start();

await Promise.all([
    woltage.executeCommand(
        place,
        'order-1',
        {
            customerId: 'customer-1',
            total: 42,
            currency: 'EUR',
            deliveryAddress: {
                street: 'Fakestreet',
                houseNumber: '8',
                postalCode: '12345',
                city: 'City'
            }
        }
    ),
    woltage.executeCommand(
        place,
        'order-2',
        {
            customerId: 'customer-2',
            total: 21,
            currency: 'USD',
            deliveryAddress: {
                street: 'Fakestreet',
                houseNumber: '6',
                postalCode: '12345',
                city: 'City'
            }
        }
    )
])
    .catch(async e => {
        if(!(e instanceof DuplicateAggregateError))
            throw e;

        console.log('Orders exist', [
            await woltage.executeQuery(Order, 'findOne', {orderId: 'order-1'}),
            await woltage.executeQuery(Order, 'findOne', {orderId: 'order-2'})
        ]);
    });

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
