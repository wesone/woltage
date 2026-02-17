import {Event, z} from 'woltage';

const schema = z.object({
    initialBalance: z.number()
});

export default class AccountOpened extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
