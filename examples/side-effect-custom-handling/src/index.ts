import createWoltage from 'woltage';
import {eventStore, stores} from './adapters.ts';
import SideEffectHelper from './SideEffectHelper.ts';
import initExample from './initExample.ts';

const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores,
    autostart: false
});

// Initialize the side effect helper before starting the application
await SideEffectHelper.init(woltage);

// Start the application after the side effect helper is ready
await woltage.start();

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
