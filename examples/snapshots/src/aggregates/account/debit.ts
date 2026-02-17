import A from './_Aggregate.ts';
import {NotFoundError, z} from 'woltage';
import AccountDebited from '../../events/AccountDebited.ts';

export default A.registerCommand(
    z.object({
        amount: z.number().positive()
    }),
    async function debit(
        {openedAt, balance},
        {amount}
    ) {
        if(!openedAt)
            throw new NotFoundError();

        if((balance - amount) < 0)
            throw new Error('Insufficient funds.');

        return new AccountDebited({
            payload: {
                amount
            }
        });
    }
);
