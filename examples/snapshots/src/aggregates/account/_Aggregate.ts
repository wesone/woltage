import {Aggregate} from 'woltage';
import AccountOpened from '../../events/AccountOpened.ts';
import AccountCredited from '../../events/AccountCredited.ts';
import AccountDebited from '../../events/AccountDebited.ts';

let eventCount = 0;
const processedEvent = () => {
    eventCount++;
    console.log(`Event count: ${eventCount}`);
};

export default Aggregate.create('account', {
    $init() {
        eventCount = 0;
        console.log('Building state...');
        return {
            openedAt: null as Date | null,
            balance: 0
        };
    },
    [AccountOpened.identity](state, event: AccountOpened) {
        processedEvent();
        return {
            ...state,
            openedAt: event.timestamp,
            balance: event.payload.initialBalance
        };
    },
    [AccountCredited.identity](state, event: AccountCredited) {
        processedEvent();
        state.balance += event.payload.amount;
        return state;
    },
    [AccountDebited.identity](state, event: AccountDebited) {
        processedEvent();
        state.balance -= event.payload.amount;
        return state;
    }
});
