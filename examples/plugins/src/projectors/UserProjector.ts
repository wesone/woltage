import {Projector, z} from 'woltage';
import type MongoDBStore from '@woltage/store-mongodb';
import UserRegistered from '../events/user/UserRegistered.ts';

const schema = {
    users: {
        key: z.object({
            id: z.string()
        }),
        schema: z.object({
            email: z.string(),
            firstName: z.string(),
            lastName: z.string()
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;

    declare store: MongoDBStore<typeof schema>;

    async [UserRegistered.identity](event: UserRegistered) {
        await this.store.tables.users.set({
            id: event.aggregateId,
            ...event.payload
        });
    }
}
