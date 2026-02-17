import {z} from 'woltage';
import Event from '../../Event.ts';
import {AVAILABLE_ROLES} from '../../utils/ACL.ts';

const schema = z.object({
    role: z.enum(AVAILABLE_ROLES)
});

export default class UserRoleAdded extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}
