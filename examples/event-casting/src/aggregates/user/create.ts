import A from './_Aggregate.ts';
import {DuplicateAggregateError, z} from 'woltage';
import UserCreated from '../../events/user/UserCreated2.ts';

export default A.registerCommand(
    z.object({
        name: z.string(),
        emailAddress: z.email(),
        department: z.string()
    }),
    async function create(
        {createdAt},
        payload
    ) {
        if(createdAt)
            throw new DuplicateAggregateError();

        // This command produces user.created@2 events.
        // But maybe some event handlers still expect version 1 events, because they haven't been updated yet.
        // No problem, the event will be automatically cast to the expected version later.
        return new UserCreated({payload});
    }
);
