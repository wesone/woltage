import createWoltage from 'woltage';
import {eventStore, stores} from './adapters.ts';
import createServer from './api/server.ts';
import initExample from './initExample.ts';

const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores
});

// Initialize the example with default data
await initExample(woltage);

// Start the api
const {server} = await createServer({port: 3000}, woltage);

// Handle graceful shutdown
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
