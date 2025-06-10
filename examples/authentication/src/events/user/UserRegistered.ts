import {z} from 'woltage';
import Event from '../../Event.ts';

const schema = z.object({
    email: z.email(),
    firstName: z.string(),
    lastName: z.string(),
    passwordHash: z.string()
});

export default class UserRegistered extends Event<typeof schema>
{
    static schema = schema;
    static version = 1;
}
