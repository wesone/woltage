import {Event, z} from 'woltage';

const schema = z.object({
    name: z.string(),
    email: z.email()
});

export default class UserCreated extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
