export default function mockConsole(prop: 'log' | 'warn' | 'error')
{
    const originalConsoleValue = console[prop];
    const calls: unknown[] = [];
    console[prop] = (...args: unknown[]) => {
        calls.push(args);
    };

    return {
        calls,
        reset: () => {
            console[prop] = originalConsoleValue;
        }
    };
}
