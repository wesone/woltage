import type {Woltage} from 'woltage';
import UserProjector from './projectors/UserProjector.ts';
import {ROLES} from './utils/ACL.ts';
import registerCommand from './aggregates/user/register.ts';
import addRoleCommand from './aggregates/user/addRole.ts';

export default async (woltage: Woltage) => {
    // Add default projection
    await woltage.addProjection('users', 1, UserProjector.name, UserProjector.version, 'mongo', true);

    // Create an admin user
    const adminUser = {
        id: '4bac06f4-6a42-4804-b920-72266139d52e',
        email: 'admin@example.com',
        firstName: 'Steve',
        lastName: 'Stevenson',
        password: '1234'
    };
    await woltage.executeCommand(registerCommand, adminUser.id, adminUser)
        .then(() => woltage.executeCommand(addRoleCommand, adminUser.id, {role: ROLES.ADMIN}))
        .catch(() => {}); // the user may already exist
};
