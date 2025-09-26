import createWoltage from 'woltage';
import stores, {eventStore} from './stores.ts';
import createServer from './api/server.ts';
import addProjections from './defaultProjections.ts';
import {ROLES} from './ACL.ts';
import UserAggregate from './aggregates/user/_Aggregate.ts';

// init woltage
const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores
});

// add default projections
await addProjections(woltage);

// this will create an admin user
const adminUser = {
    id: '4bac06f4-6a42-4804-b920-72266139d52e',
    email: 'admin@example.com',
    firstName: 'Steve',
    lastName: 'Stevenson',
    password: '1234'
};
await woltage.executeCommand(UserAggregate, adminUser.id, 'register', adminUser)
    .then(() => woltage.executeCommand(UserAggregate, adminUser.id, 'addRole', {role: ROLES.ADMIN}))
    // the user may already exists
    .catch(() => {});

// start the api
const {server} = await createServer({port: 3000}, woltage);

// handle a shut down
[
    'SIGTERM',
    'SIGINT',
    'SIGUSR2'
].forEach(type => {
    process.once(type, async () => {
        try
        {
            await new Promise(resolve => server.close(resolve));
            await woltage.stop();
            console.log('Application was gracefully shut down...');
        }
        finally
        {
            process.kill(process.pid, type);
        }
    });
});
