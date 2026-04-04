import {type Woltage, DuplicateAggregateError} from 'woltage';
import OrderProjector from './projectors/OrderProjector.ts';
import place from './aggregates/order/place.ts';
import Order from './readModels/Order.ts';

export default async (woltage: Woltage) => {
    // Add default projection
    await woltage.addProjection('orders', 1, OrderProjector.name, OrderProjector.version, 'mongo', true);

    // Execute some commands
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

            console.log('Orders already exist', [
                await woltage.executeQuery(Order, 'findOne', {orderId: 'order-1'}),
                await woltage.executeQuery(Order, 'findOne', {orderId: 'order-2'})
            ]);
        });
};
