import {Event, z} from 'woltage';

const schema = z.object({
    reason: z.string()
});

export default class OrderCanceled extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
