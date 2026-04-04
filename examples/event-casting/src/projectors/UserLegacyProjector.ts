import {Projector, z} from 'woltage';
import UserCreated from '../events/user/UserCreated.ts';

const schema = {
    users: {
        key: z.object({
            userId: z.string()
        }),
        schema: z.object({
            email: z.string(),
            name: z.string()
        })
    }
};

export default class UserLegacyProjector extends Projector<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;

    async [UserCreated.identity](event: UserCreated) {
        await this.tables.users.set({
            ...event.payload,
            userId: event.aggregateId
        });
    }
}
