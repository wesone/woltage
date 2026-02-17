import {Event, z} from 'woltage';

const schema = z.object({
    shippingCompany: z.enum(['FedEx', 'UPS', 'USPS', 'DHL']),
    trackingNumber: z.string().optional()
});

export default class OrderShipped extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
