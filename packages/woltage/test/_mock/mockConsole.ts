export default function mockConsole(prop: 'log' | 'warn' | 'error' | 'trace')
{
    const originalConsoleValue = console[prop];
    const consoleCalls: unknown[] = [];
    console[prop] = (...args: unknown[]) => {
        consoleCalls.push(args);
    };

    return {
        consoleCalls,
        resetConsoleMock: () => {
            console[prop] = originalConsoleValue;
        }
    };
}
