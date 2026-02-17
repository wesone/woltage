import {ReadModel, z} from 'woltage';
import type OrderProjector from '../projectors/OrderProjector.ts';

export default class Order extends ReadModel<OrderProjector>
{
    projectionName = 'orders';
    schemaRegistry = {
        findOne: z.object({
            orderId: z.string()
        })
    };

    async findOne(query: z.infer<this['schemaRegistry']['findOne']>) {
        return await this.store.tables.orders.get(query);
    }
}


