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

        return new UserCreated({payload});
    }
);
