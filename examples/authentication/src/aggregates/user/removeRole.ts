import A from './_Aggregate.ts';
import {NotFoundError, UnalteredError, z} from 'woltage';
import {AVAILABLE_ROLES} from '../../ACL.ts';
import UserRoleRemoved from '../../events/user/UserRoleRemoved.ts';

A.registerCommand(
    z.object({
        role: z.enum(AVAILABLE_ROLES),
    }),
    async function removeRole(
        {isRegistered, roles},
        {role}
    ) {
        if(!isRegistered)
            throw new NotFoundError();

        if(!roles.includes(role))
            throw new UnalteredError();

        return new UserRoleRemoved({
            payload: {role}
        });
    }
);
