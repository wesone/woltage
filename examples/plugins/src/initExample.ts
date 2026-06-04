import type {Woltage} from 'woltage';
import UserProjector from './projectors/UserProjector.ts';
import registerUserCommand from './aggregates/user/register.ts';

export default async (woltage: Woltage) => {
    await woltage.addProjection('users', 1, UserProjector.name, UserProjector.version, 'mongo', true);

    await woltage.executeCommand(
        registerUserCommand,
        'user-2',
        {
            email: 'steve@example.com',
            firstName: 'Steve',
            lastName: 'Stevenson'
        },
        {
            userId: 'user-1',
            roles: ['admin']
        }
    );
};
