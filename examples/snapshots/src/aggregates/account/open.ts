import A from './_Aggregate.ts';
import {DuplicateAggregateError, z} from 'woltage';
import AccountOpened from '../../events/AccountOpened.ts';

export default A.registerCommand(
    z.object({
        initialBalance: z.number()
    }),
    async function open(
        {openedAt},
        {initialBalance}
    ) {
        if(openedAt)
            throw new DuplicateAggregateError();

        if(initialBalance < 0)
            throw new Error('Initial balance can\'t be negative.');

        return new AccountOpened({
            payload: {
                initialBalance
            }
        });
    }
);
