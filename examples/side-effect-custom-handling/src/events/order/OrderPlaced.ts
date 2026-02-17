import {Event, z} from 'woltage';

const schema = z.object({
    customerId: z.string(),
    total: z.number(),
    currency: z.enum(['USD', 'EUR']),
    deliveryAddress: z.object({
        street: z.string(),
        houseNumber: z.string(),
        postalCode: z.string(),
        city: z.string()
    })
});

export default class OrderPlaced extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
