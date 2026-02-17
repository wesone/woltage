import createWoltage from 'woltage';
import {eventStore, stores} from './adapters.ts';
import open from './aggregates/account/open.ts';
import credit from './aggregates/account/credit.ts';
import debit from './aggregates/account/debit.ts';

// init woltage
const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: [],
    internalStore: stores.redis,
    snapshots: {
        store: stores.redis,
        eventCount: 10
    }
});

await woltage.executeCommand(open, 'account-1', {initialBalance: 0});
await woltage.executeCommand(credit, 'account-1', {amount: 10});
await woltage.executeCommand(credit, 'account-1', {amount: 5});
await woltage.executeCommand(credit, 'account-1', {amount: 5});
await woltage.executeCommand(debit, 'account-1', {amount: 10});
await woltage.executeCommand(credit, 'account-1', {amount: 500});
await woltage.executeCommand(debit, 'account-1', {amount: 100});
await woltage.executeCommand(credit, 'account-1', {amount: 10});
await woltage.executeCommand(debit, 'account-1', {amount: 420});
await woltage.executeCommand(credit, 'account-1', {amount: 10});
await woltage.executeCommand(credit, 'account-1', {amount: 5});
await woltage.executeCommand(credit, 'account-1', {amount: 5});
await woltage.executeCommand(debit, 'account-1', {amount: 10});
await woltage.executeCommand(credit, 'account-1', {amount: 500});
await woltage.executeCommand(debit, 'account-1', {amount: 100});
await woltage.executeCommand(credit, 'account-1', {amount: 10});
await woltage.executeCommand(debit, 'account-1', {amount: 420});
console.log('Transactions created...');

// handle a shut down
[
    'SIGTERM',
    'SIGINT',
    'SIGUSR2'
].forEach(type => {
    process.once(type, async () => {
        try
        {
            await woltage.stop();
            console.log('Application was gracefully shut down...');
        }
        finally
        {
            process.kill(process.pid, type);
        }
    });
});
