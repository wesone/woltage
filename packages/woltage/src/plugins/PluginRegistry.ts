import ReadModel, {ReadModelContext} from '../read/ReadModel.ts';
import type {CommandInfo, CommandContext, StateUpdate} from '../write/Aggregate.ts';

type FilterBySuffix<T extends string, Suffix extends string> =
    T extends `${string}${Suffix}` ? T : never;

class PluginBreakError extends Error
{
    returnedError;

    constructor(returnedError: Error) {
        super();
        this.returnedError = returnedError;
    }
}

type HookDefinition<TData, TResult> = (data: TData) => Promise<TResult | void> | TResult | void;

type ErrorHookResult = {
    suppress?: boolean;
    error?: Error;
};

type ErrorHookDefinition<TData, TResult extends ErrorHookResult = ErrorHookResult> = HookDefinition<TData & {error: Error}, TResult>;

export type BeforeCommandValidationHook = HookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    context?: Record<string, unknown>;
}, {
    error?: Error;
    payload?: unknown;
}>

export type OnCommandValidationErrorHook = ErrorHookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    context?: Record<string, unknown>;
}>

export type BeforeCommandExecutionHook = HookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    state: unknown;
    context: CommandContext;
}, {
    error?: Error;
    payload?: unknown;
    state?: unknown;
    context?: CommandContext;
}>

export type OnCommandExecutionErrorHook = ErrorHookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    state: unknown;
    context: CommandContext;
}>

export type AfterCommandExecutionHook = HookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    state: unknown;
    context: CommandContext;
    stateUpdate: StateUpdate | void;
}, {
    error?: Error;
    stateUpdate?: StateUpdate;
}>

export type OnCommandErrorHook = ErrorHookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    context?: Record<string, unknown>;
}>

export type BeforeReadModelValidationHook = HookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context?: Record<string, unknown>;
}, {
    error?: Error;
    query?: unknown;
}>

export type OnReadModelValidationErrorHook = ErrorHookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context?: Record<string, unknown>;
}>

export type BeforeReadModelExecutionHook = HookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context: ReadModelContext;
}, {
    error?: Error;
    query?: unknown;
    context?: CommandContext;
}>

export type OnReadModelExecutionErrorHook = ErrorHookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context: ReadModelContext;
}>

export type AfterReadModelExecutionHook = HookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context: ReadModelContext;
    result: unknown;
}, {
    error?: Error;
    result?: unknown;
}>

export type OnReadModelErrorHook = ErrorHookDefinition<{
    readModel: ReadModel;
    handlerName: string;
    query: unknown;
    context?: Record<string, unknown>;
}>

export interface Plugin {
    /** The unique handle for the plugin. */
    handle: string;
    /** The name of the plugin. */
    name?: string;
    /** The version of the plugin. */
    version?: string;
    /**
     * Defines how unhandled errors thrown by this plugin's hooks should be handled.
     * - 'log': Errors will be logged to the console, but execution will continue.
     * - 'throw': Errors will be propagated and may cause execution to fail.
     * - 'ignore': Errors will be silently ignored.
     *
     * Default: 'log'
     */
    errorStrategy?: 'log' | 'throw' | 'ignore';
    /** The hooks that this plugin registers. */
    hooks?: {
        /**
         * Runs before a command's validation.
         *
         * May transform the `payload` that's used for validation.
         */
        beforeCommandValidation?: BeforeCommandValidationHook;
        /**
         * Runs whenever a command validation fails.
         */
        onCommandValidationError?: OnCommandValidationErrorHook;
        /**
         * Runs before a command handler will be called.
         *
         * May transform `state`, `payload`, `context`,
         * that will be passed to the command handler.
         */
        beforeCommandExecution?: BeforeCommandExecutionHook;
        /**
         * Runs whenever a command handler throws an error.
         */
        onCommandExecutionError?: OnCommandExecutionErrorHook;
        /**
         * Runs after a command handler was executed.
         *
         * May manipulate the return value of the command handler.
         */
        afterCommandExecution?: AfterCommandExecutionHook;
        /**
         * Runs whenever a command related error occurs.
         */
        onCommandError?: OnCommandErrorHook;
        /**
         * Runs before a read models's validation.
         *
         * May transform the `query` that's used for validation.
         */
        beforeReadModelValidation?: BeforeReadModelValidationHook;
        /**
         * Runs whenever a read model validation fails.
         */
        onReadModelValidationError?: OnReadModelValidationErrorHook;
        /**
         * Runs before a read model handler will be called.
         *
         * May transform `query`, `context`,
         * that will be passed to the read model handler.
         */
        beforeReadModelExecution?: BeforeReadModelExecutionHook;
        /**
         * Runs whenever a read model handler throws an error.
         */
        onReadModelExecutionError?: OnReadModelExecutionErrorHook;
        /**
         * Runs after a read model handler was executed.
         *
         * May manipulate the return value of the read model handler.
         */
        afterReadModelExecution?: AfterReadModelExecutionHook;
        /**
         * Runs whenever a read model related error occurs.
         */
        onReadModelError?: OnReadModelErrorHook;
    };
}

type Hooks = Required<NonNullable<Plugin['hooks']>>;
type HookName = keyof Hooks;
type ErrorHookName = FilterBySuffix<HookName, 'Error'>;

type HookData<T extends HookDefinition<any, any>> = T extends HookDefinition<infer TData, any>
    ? TData
    : never;
type HookResult<T extends HookDefinition<any, any>> = T extends HookDefinition<any, infer TResult>
    ? TResult
    : never;

type HookExecutors = {
    [H in HookName]: (data: HookData<Hooks[H]>) => Promise<unknown>;
};

export class PluginRegistry implements HookExecutors
{
    #hooks: Record<HookName, {plugin: Plugin; hook: NonNullable<any>}[]> = {
        beforeCommandValidation: [],
        onCommandValidationError: [],
        beforeCommandExecution: [],
        onCommandExecutionError: [],
        afterCommandExecution: [],
        onCommandError: [],
        beforeReadModelValidation: [],
        onReadModelValidationError: [],
        beforeReadModelExecution: [],
        onReadModelExecutionError: [],
        afterReadModelExecution: [],
        onReadModelError: []
    };

    constructor(plugins: Plugin[] = []) {
        const handles = new Set<string>();
        for(const plugin of plugins)
        {
            if(!plugin.handle?.length)
                throw new Error('Plugin handle must be provided and non-empty.');
            if(handles.has(plugin.handle))
                throw new Error(`Plugin handle '${plugin.handle}' is duplicated.`);
            handles.add(plugin.handle);
        }

        for(const plugin of plugins)
        {
            for(const hookName of Object.keys(this.#hooks) as HookName[])
            {
                const hook = plugin.hooks?.[hookName];
                if(hook)
                    this.#hooks[hookName].push({plugin, hook});
            }
        }
    }

    hasHook(hookName: HookName) {
        return this.#hooks[hookName].length > 0;
    }

    #getDisplayName(plugin: Plugin) {
        return plugin.name ?? plugin.handle;
    }

    async #callHooks<T extends HookName>(
        hookName: T,
        data: HookData<Hooks[T]>,
        processor: (hookResult: HookResult<Hooks[T]>, plugin: Plugin) => Promise<boolean>
    ): Promise<void> {
        for(const entry of this.#hooks[hookName])
        {
            const {plugin, hook} = entry;
            try
            {
                const shouldContinue = await processor(await hook(data), plugin);
                if(!shouldContinue)
                    break;
            }
            catch(error)
            {
                // PluginBreakError is always fatal regardless of errorStrategy setting
                if(error instanceof PluginBreakError)
                    throw error.returnedError;

                const strategy = plugin.errorStrategy ?? 'log';
                if(strategy === 'log')
                    console.error(`Plugin ${this.#getDisplayName(plugin)} error in '${hookName}':`, error);
                else if(strategy === 'throw')
                    throw error;
                // 'ignore' strategy: silently continue
            }
        }
    }

    async run<T extends HookName>(hookName: T, data: HookData<Hooks[T]>) {
        return await this[hookName]?.(data as any) as ReturnType<this[T]>;
    }

    async handleError<T extends ErrorHookName>(hookName: T, data: Omit<HookData<Hooks[T]>, 'error'> & {error: unknown}) {
        if(data.error instanceof Error)
        {
            const errorHookResult = await this.run(hookName, data as HookData<Hooks[T]>);
            if(errorHookResult?.suppress)
                return;

            throw errorHookResult?.error ?? data.error;
        }

        throw data.error;
    }

    async errorHookExecutor<T extends ErrorHookName>(hookName: T, data: HookData<Hooks[T]>) {
        let shouldSuppress = false;
        let error = data.error;

        await this.#callHooks(hookName, data, async result => {
            if(result)
            {
                if(result.error !== undefined)
                {
                    error = result.error;
                    data.error = error;
                }
                if(result.suppress !== undefined)
                    shouldSuppress = result.suppress;
            }
            return true;
        });

        return {error, suppress: shouldSuppress};
    }

    async beforeCommandValidation(data: HookData<BeforeCommandValidationHook>) {
        let payload = data.payload;

        await this.#callHooks('beforeCommandValidation', data, async result => {
            if(result)
            {
                if(result.payload !== undefined)
                {
                    payload = result.payload;
                    data.payload = payload;
                }
                if(result.error !== undefined)
                    throw new PluginBreakError(result.error);
            }
            return true;
        });

        return payload;
    }

    async onCommandValidationError(data: HookData<OnCommandValidationErrorHook>) {
        return this.errorHookExecutor('onCommandValidationError', data);
    }

    async beforeCommandExecution(data: HookData<BeforeCommandExecutionHook>) {
        const returnValue = {
            payload: data.payload,
            state: data.state,
            context: data.context
        };
        const returnKeys = Object.keys(returnValue) as (keyof typeof returnValue)[];

        await this.#callHooks('beforeCommandExecution', data, async result => {
            if(result)
            {
                returnKeys.forEach(key => {
                    if(key in result)
                    {
                        returnValue[key] = result[key] as any;
                        data[key] = returnValue[key] as any;
                    }
                });
                if(result.error !== undefined)
                    throw new PluginBreakError(result.error);
            }
            return true;
        });

        return returnValue;
    }

    async onCommandExecutionError(data: HookData<OnCommandExecutionErrorHook>) {
        return this.errorHookExecutor('onCommandExecutionError', data);
    }

    async afterCommandExecution(data: HookData<AfterCommandExecutionHook>) {
        let stateUpdate = data.stateUpdate;

        await this.#callHooks('afterCommandExecution', data, async result => {
            if(result)
            {
                if(result.stateUpdate !== undefined)
                {
                    stateUpdate = result.stateUpdate;
                    data.stateUpdate = stateUpdate;
                }
                if(result.error !== undefined)
                    throw new PluginBreakError(result.error);
            }
            return true;
        });

        return stateUpdate;
    }

    async onCommandError(data: HookData<OnCommandErrorHook>) {
        return this.errorHookExecutor('onCommandError', data);
    }

    async beforeReadModelValidation(data: HookData<BeforeReadModelValidationHook>) {
        let query = data.query;

        await this.#callHooks('beforeReadModelValidation', data, async result => {
            if(result)
            {
                if(result.query !== undefined)
                {
                    query = result.query;
                    data.query = query;
                }
                if(result.error !== undefined)
                    throw new PluginBreakError(result.error);
            }
            return true;
        });

        return query;
    }

    async onReadModelValidationError(data: HookData<OnReadModelValidationErrorHook>) {
        return this.errorHookExecutor('onReadModelValidationError', data);
    }

    async beforeReadModelExecution(data: HookData<BeforeReadModelExecutionHook>) {
        const returnValue = {
            query: data.query,
            context: data.context
        };
        const returnKeys = Object.keys(returnValue) as (keyof typeof returnValue)[];

        await this.#callHooks('beforeReadModelExecution', data, async result => {
            if(result)
            {
                returnKeys.forEach(key => {
                    if(key in result)
                    {
                        returnValue[key] = result[key] as any;
                        data[key] = returnValue[key] as any;
                    }
                });
                if(result.error !== undefined)
                    throw new PluginBreakError(result.error);
            }
            return true;
        });

        return returnValue;
    }

    async onReadModelExecutionError(data: HookData<OnReadModelExecutionErrorHook>) {
        return this.errorHookExecutor('onReadModelExecutionError', data);
    }

    async afterReadModelExecution(data: HookData<AfterReadModelExecutionHook>) {
        let result = data.result;

        await this.#callHooks('afterReadModelExecution', data, async res => {
            if(res)
            {
                if(res.result !== undefined)
                {
                    result = res.result;
                    data.result = result;
                }
                if(res.error !== undefined)
                    throw new PluginBreakError(res.error);
            }
            return true;
        });

        return result;
    }

    async onReadModelError(data: HookData<OnReadModelErrorHook>) {
        return this.errorHookExecutor('onReadModelError', data);
    }
}

export default PluginRegistry;
