import A from './_Aggregate.ts';
import {NotFoundError, UnalteredError, z} from 'woltage';
import {AVAILABLE_ROLES} from '../../utils/ACL.ts';
import UserRoleAdded from '../../events/user/UserRoleAdded.ts';

A.registerCommand(
    z.object({
        role: z.enum(AVAILABLE_ROLES)
    }),
    async function addRole(
        {isRegistered, roles},
        {role}
    ) {
        if(!isRegistered)
            throw new NotFoundError();

        if(roles.includes(role))
            throw new UnalteredError();

        return new UserRoleAdded({
            payload: {role}
        });
    }
);
