import {Aggregate} from 'woltage';
import UserRegistered from '../../events/user/UserRegistered.ts';

export default Aggregate.create('user', {
    $init() {
        return {
            isCreated: false,
            email: '',
            firstName: '',
            lastName: ''
        };
    },

    [UserRegistered.identity](state, event: UserRegistered) {
        return {
            ...state,
            ...event.payload,
            isCreated: true
        };
    }
});
