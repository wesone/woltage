import A from './_Aggregate.ts';
import {NotFoundError, z} from 'woltage';
import AccountCredited from '../../events/AccountCredited.ts';

export default A.registerCommand(
    z.object({
        amount: z.number().positive()
    }),
    async function credit(
        {openedAt},
        {amount}
    ) {
        if(!openedAt)
            throw new NotFoundError();

        return new AccountCredited({
            payload: {
                amount
            }
        });
    }
);
