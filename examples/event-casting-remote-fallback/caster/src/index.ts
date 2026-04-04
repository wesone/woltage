import getServer from './getServer.ts';

// Start the server
const server = await getServer();

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
            console.log('Caster was gracefully shut down...');
        }
        finally
        {
            process.kill(process.pid, type);
        }
    });
});
