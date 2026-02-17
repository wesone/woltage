import {Event, z} from 'woltage';

const schema = z.object({
    amount: z.number()
});

export default class AccountCredited extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
