import {Projector, z} from 'woltage';
import type MongoDBStore from '@woltage/store-mongodb';
import UserCreated from '../events/user/UserCreated2.ts';

const schema = {
    users: {
        key: z.object({
            userId: z.string()
        }),
        schema: z.object({
            emailAddress: z.string(),
            name: z.string(),
            department: z.string()
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;

    declare store: MongoDBStore<typeof schema>;

    async [UserCreated.identity](event: UserCreated) {
        await this.tables.users.set({
            ...event.payload,
            userId: event.aggregateId
        });
    }
}
