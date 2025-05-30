import A from './_Aggregate.ts';
import {z} from 'zod/v4';
import {ConflictError, DuplicateAggregateError} from 'woltage';
import {generatePasswordHash} from '../../utils/password.ts';
import UserRegistered from '../../events/user/UserRegistered.ts';
import User from '../../readModels/User.ts';

A.registerCommand(
    z.object({
        email: z.email(),
        firstName: z.string(),
        lastName: z.string(),
        password: z.string()
    }),
    async function register(
        {isRegistered},
        payload
    ) {
        if(isRegistered)
            throw new DuplicateAggregateError();

        if(!await User.get().isEmailAddressAvailable(payload.email))
            throw new ConflictError('Email address is not available.');

        const passwordHash = await generatePasswordHash(payload.password);

        return new UserRegistered({
            payload: {
                ...payload,
                passwordHash
            }
        });
    }
);
