import {Aggregate} from 'woltage';
import AccountOpened from '../../events/AccountOpened.ts';
import AccountCredited from '../../events/AccountCredited.ts';
import AccountDebited from '../../events/AccountDebited.ts';

let eventCount = 0;
const processEvent = () => {
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
        processEvent();
        return {
            ...state,
            openedAt: event.timestamp,
            balance: event.payload.initialBalance
        };
    },
    [AccountCredited.identity](state, event: AccountCredited) {
        processEvent();
        state.balance += event.payload.amount;
        return state;
    },
    [AccountDebited.identity](state, event: AccountDebited) {
        processEvent();
        state.balance -= event.payload.amount;
        return state;
    }
});
