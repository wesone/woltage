import {z} from 'zod/v4';
import {Projector} from 'woltage';
import type MongoDBStore from '@woltage/store-mongodb';
import UserRegistered from '../events/user/UserRegistered.ts';
import {ROLES, AVAILABLE_ROLES} from '../ACL.ts';
import UserRoleAdded from '../events/user/UserRoleAdded.ts';
import UserRoleRemoved from '../events/user/UserRoleRemoved.ts';

const schema = {
    emails: {
        key: z.object({
            email: z.email()
        }),
        schema: z.object({
            userId: z.uuid(),
            registeredAt: z.number()
        })
    },
    users: {
        key: z.object({
            id: z.string()
        }),
        schema: z.object({
            email: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            passwordHash: z.string(),
            roles: z.array(z.enum(AVAILABLE_ROLES))
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static schema = schema;
    static version = 1;

    declare store: MongoDBStore<typeof schema>;

    async [UserRegistered.identity](event: UserRegistered) {
        const {emails, users} = this.store.tables;

        if(await emails.get({email: event.payload.email})) // maybe a conflicting user registration
            return;

        await emails.set({
            email: event.payload.email,
            userId: event.aggregateId,
            registeredAt: event.timestamp
        });
        await users.set({
            ...event.payload,
            roles: [ROLES.USER],
            id: event.aggregateId
        });
    }

    async updateUserRole(event: UserRoleAdded | UserRoleRemoved) {
        const {users} = this.store.tables;
        const {aggregateId: id, payload: {role}} = event;
        const user = await users.get({id});
        if(!user)
            return;
        if(event instanceof UserRoleAdded)
            user.roles.push(role);
        else
            user.roles.splice(user.roles.indexOf(role), 1);
        await users.set(user);
    }

    async [UserRoleAdded.identity](event: UserRoleAdded) {
        await this.updateUserRole(event);
    }

    async [UserRoleRemoved.identity](event: UserRoleRemoved) {
        await this.updateUserRole(event);
    }
}
