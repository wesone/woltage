import {Aggregate} from 'woltage';
import UserRegistered from '../../events/user/UserRegistered.ts';
import {ROLES, type Role} from '../../ACL.ts';
import UserRoleAdded from '../../events/user/UserRoleAdded.ts';

export default Aggregate.create('user', {
    $init() {
        return {
            isRegistered: false,
            email: '',
            firstName: '',
            lastName: '',
            roles: [ROLES.USER] as Role[]
        };
    },
    [UserRegistered.identity](state, event: UserRegistered) {
        return {
            ...state,
            ...event.payload,
            isRegistered: true
        };
    },
    [UserRoleAdded.identity](state, event: UserRoleAdded) {
        state.roles.push(event.payload.role);
        return state;
    }
});
