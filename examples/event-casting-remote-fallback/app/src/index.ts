import createWoltage from 'woltage';
import {Event} from 'woltage';
import {eventStore, stores} from './adapters.ts';
import initExample from './initExample.ts';

const woltage = await createWoltage({
    eventStore,
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores,
    async eventCastingFallback(event: Event, targetVersion: number) {
        const currentEventDiplayName = event.getDisplayName();
        console.log(`Unable to cast ${currentEventDiplayName} to version ${targetVersion}... Calling remote server.`);

        const response = await fetch(`${process.env.CASTER_URL}/cast`, {
            method: 'post',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({event: event.toJSON(), targetVersion})
        });

        if(response.ok)
        {
            const castEvent = Event.fromJSON(await response.json());
            console.log(`Remote casting success for ${currentEventDiplayName}. Processing as ${castEvent.getDisplayName()} now.`);
            return castEvent;
        }

        throw new Error('The remote fallback failed.');
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
