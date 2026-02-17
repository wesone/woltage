import {Event, z} from 'woltage';

const schema = z.object({
    expectedPreperationTime: z.number()
});

export default class OrderAcceptedByRestaurant extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
