import A from './_Aggregate.ts';
import {DuplicateAggregateError, z} from 'woltage';
import UserCreated from '../../events/user/UserCreated.ts';

export default A.registerCommand(
    z.object({
        name: z.string(),
        email: z.email()
    }),
    async function createLegacy(
        {createdAt},
        payload
    ) {
        if(createdAt)
            throw new DuplicateAggregateError();

        // This command produces user.created@1 events.
        // Maybe some third-party service still relies on the old command schema
        // or maybe this legacy command can be safely deleted, so there won't be any new user.created@1 producers.
        return new UserCreated({payload});
    }
);
