import PluginRegistry, {type Plugin, type Hooks} from '../../src/plugins/PluginRegistry.ts';

/**
 * Returns a plugin to be used with a plugin registry.
 */
export default function mockPlugin(overrides: Partial<Plugin> = {})
{
    const id = Math.random().toString(16).slice(2);
    return {
        handle: `plugin-${id}`,
        name: `Test Plugin ${id}`,
        errorStrategy: 'ignore',
        hooks: {},
        ...overrides
    } satisfies Plugin;
}

/**
 * @param hooks The hooks for a plugin or an array with hooks for multiple plugins
 * @param overrides Plugin overrides (if multiple plugins are registered, the overrides will be used for all of them)
 */
export function mockPluginRegistry(hooks: Partial<Hooks> | Partial<Hooks>[], overrides: Partial<Omit<Plugin, 'hooks'>> = {})
{
    if(!Array.isArray(hooks))
        hooks = [hooks];
    return new PluginRegistry(
        hooks.map(hooks => mockPlugin({...overrides, hooks}))
    );
}
