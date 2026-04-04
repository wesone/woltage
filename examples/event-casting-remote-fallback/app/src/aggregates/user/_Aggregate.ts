import {Aggregate} from 'woltage';
import UserCreated from '../../events/user/UserCreated2.ts';

export default Aggregate.create('user', {
    $init() {
        return {
            createdAt: null as Date | null,
            name: '',
            emailAddress: '',
            department: ''
        };
    },
    [UserCreated.identity](state, event: UserCreated) {
        const {name, emailAddress, department} = event.payload;
        return {
            ...state,
            createdAt: event.timestamp,
            name,
            emailAddress,
            department
        };
    }
});
