import type {Woltage} from 'woltage';
import UserProjector from './projectors/UserProjector.ts';
import registerUserCommand from './aggregates/user/register.ts';
import removeUserCommand from './aggregates/user/remove.ts';

export default async (woltage: Woltage) => {
    await woltage.addProjection('users', 1, UserProjector.name, UserProjector.version, 'mongo', true);

    const users = [
        {
            id: 'user-1',
            email: 'steve@example.com',
            firstName: 'Steve',
            lastName: 'Stevenson'
        },
        {
            id: 'user-2',
            email: 'jeff@example.com',
            firstName: 'Jeff',
            lastName: 'Jefferson'
        }
    ];

    await Promise.allSettled(
        users.map(({id, ...payload}) => (
            woltage.executeCommand(
                registerUserCommand,
                id,
                payload
            )
        ))
    );

    await woltage.executeCommand(
        removeUserCommand,
        users[0].id,
        {reason: 'GDPR'}
    );

    // This will throw because `users[0].id` is permanently removed and can not be reused.
    await woltage.executeCommand(
        registerUserCommand,
        users[0].id,
        {
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe'
        }
    );
};
