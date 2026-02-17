import {Event, z} from 'woltage';

const schema = z.object({
    customerId: z.string(),
    restraurantId: z.string(),
    food: z.string(),
    total: z.number()
});

export default class OrderPlaced extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
