import {Event, z} from 'woltage';

const schema = z.object({
    email: z.email(),
    firstName: z.string(),
    lastName: z.string()
});

export default class UserRegistered extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
