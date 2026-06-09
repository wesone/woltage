import A from './_Aggregate.ts';
import {NotFoundError, TombstoneEvent, z} from 'woltage';

export default A.registerCommand(
    z.object({
        reason: z.string()
    }),
    async function remove(
        {isCreated},
        payload
    ) {
        if(!isCreated)
            throw new NotFoundError();

        return new TombstoneEvent({
            payload
        });
    }
);
