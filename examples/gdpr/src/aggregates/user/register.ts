import A from './_Aggregate.ts';
import {z} from 'woltage';
import UserRegistered from '../../events/user/UserRegistered.ts';

export default A.registerCommand(
    z.object({
        email: z.email(),
        firstName: z.string(),
        lastName: z.string()
    }),
    async function register(
        {isCreated},
        payload
    ) {
        if(isCreated)
            throw new Error('User already exists.');

        return new UserRegistered({
            payload
        });
    }
);
