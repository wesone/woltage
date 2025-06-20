import {z} from 'woltage';
import Event from '../../Event.ts';
import {AVAILABLE_ROLES} from '../../ACL.ts';

const schema = z.object({
    role: z.enum(AVAILABLE_ROLES),
});

export default class UserRoleRemoved extends Event<typeof schema>
{
    static schema = schema;
    static version = 1;
}
