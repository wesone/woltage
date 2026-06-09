import {Projector, TombstoneEvent, z} from 'woltage';
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

    async [UserRegistered.identity](event: UserRegistered) {
        console.log(`Writing ${event.aggregateId} (${event.payload.firstName} ${event.payload.lastName}) to database.`);
        await this.tables.users.set({
            id: event.aggregateId,
            ...event.payload
        });
    }

    async [TombstoneEvent.identity](event: TombstoneEvent) {
        console.log(`Removing ${event.aggregateId} from database.`);
        await this.tables.users.remove({
            id: event.aggregateId
        });
    }
}
