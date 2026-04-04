import createWoltage from 'woltage';
import {eventStore, stores} from './adapters.ts';
import initExample from './initExample.ts';

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

// Initialize the example with default data
await initExample(woltage);

// Handle graceful shutdown
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
