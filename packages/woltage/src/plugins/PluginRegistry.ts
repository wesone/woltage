import ReadModel, {type ReadModelContext} from '../read/ReadModel.ts';
import type {CommandInfo, CommandContext, StateUpdate} from '../write/Aggregate.ts';

type FilterBySuffix<T extends string, Suffix extends string> =
    T extends `${string}${Suffix}` ? T : never;

type GeneralHookResult = {
    /**
     * Indicates whether the execution of subsequent hooks for this event should be stopped.
     *
     * Set to `true` to prevent calling registered hooks after this one for the current event.
     */
    breakChain?: boolean;
    /**
     * Return an error to be thrown after calling the registered hooks for the current event
     * regardless of the specified `errorStrategy`.
     */
    error?: Error;
};

type HookDefinition<TData, TResult, TReturn = TResult & GeneralHookResult> = (data: TData) =>
    Promise<TReturn | void> | TReturn | void;

type ErrorHookResult = {
    /** Set to `true` to swallow the error and prevent throwing. */
    suppress?: boolean;
};

type ErrorHookDefinition<TData, TResult extends ErrorHookResult = ErrorHookResult> = HookDefinition<TData & {error: Error}, TResult>;

export type BeforeCommandValidationHook = HookDefinition<{
    commandInfo: CommandInfo;
    aggregateId: string;
    payload: unknown;
    context?: Record<string, unknown>;
}, {
    payload?: unknown;
    skip?: boolean;
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
    query?: unknown;
    skip?: boolean;
}>

export type OnReadModelValidationErrorHook<R extends ReadModel = ReadModel> = ErrorHookDefinition<{
    readModel: R;
    handlerName: keyof R | string;
    query: unknown;
    context?: Record<string, unknown>;
}>

export type BeforeReadModelExecutionHook<R extends ReadModel = ReadModel> = HookDefinition<{
    readModel: R;
    handlerName: keyof R | string;
    query: unknown;
    context: ReadModelContext;
}, {
    query?: unknown;
    context?: ReadModelContext;
}>

export type OnReadModelExecutionErrorHook<R extends ReadModel = ReadModel> = ErrorHookDefinition<{
    readModel: R;
    handlerName: keyof R | string;
    query: unknown;
    context: ReadModelContext;
}>

export type AfterReadModelExecutionHook<R extends ReadModel = ReadModel> = HookDefinition<{
    readModel: R;
    handlerName: keyof R | string;
    query: unknown;
    context: ReadModelContext;
    result: unknown;
}, {
    result?: unknown;
}>

export type OnReadModelErrorHook<R extends ReadModel = ReadModel> = ErrorHookDefinition<{
    readModel: R;
    handlerName: keyof R | string;
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

export type Hooks = Required<NonNullable<Plugin['hooks']>>;
export type HookName = keyof Hooks;
export type ErrorHookName = FilterBySuffix<HookName, 'Error'>;

export type HookData<
    T extends HookDefinition<any, any> | HookName,
    H extends HookDefinition<any, any> = T extends HookName ? Hooks[T] : T
> = Parameters<H>[0];
export type HookResult<
    T extends HookDefinition<any, any> | HookName,
    H extends HookDefinition<any, any> = T extends HookName ? Hooks[T] : T
> = ReturnType<H>;

type HookExecutors = {
    [T in HookName]: (data: HookData<T>) => Promise<unknown>;
};

export class PluginRegistry implements HookExecutors
{
    #hooks: {[T in HookName]: {plugin: Plugin; hook: NonNullable<Hooks[T]>}[]} = {
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
        this.#registerHooks(plugins);
    }

    #registerHooks<T extends HookName>(plugins: Plugin[]) {
        const handles = new Set<string>();
        for(const plugin of plugins)
        {
            if(typeof plugin.handle !== 'string' || !plugin.handle.length)
                throw new Error('Plugin handle must be a non-empty string.');
            if(handles.has(plugin.handle))
                throw new Error(`Plugin handle '${plugin.handle}' is duplicated.`);
            handles.add(plugin.handle);
        }

        for(const plugin of plugins)
        {
            for(const hookName of Object.keys(this.#hooks) as T[])
            {
                const hook = plugin.hooks?.[hookName] as Hooks[T] | undefined;
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
        data: HookData<T>,
        processor: (hookResult: Awaited<HookResult<T>>, plugin: Plugin) => Promise<void>
    ): Promise<void> {
        for(const {plugin, hook} of this.#hooks[hookName])
        {
            try
            {
                const result = await (hook(data as any) as HookResult<T>);
                await processor(result, plugin);
                if(result?.breakChain)
                    break;
            }
            catch(error)
            {
                const strategy = plugin.errorStrategy ?? 'log';
                if(strategy === 'log')
                    console.error(`Plugin ${this.#getDisplayName(plugin)} error in '${hookName}':`, error);
                else if(strategy === 'throw')
                    throw error;
                // 'ignore' strategy: silently continue
            }
        }
    }

    async run<T extends HookName>(hookName: T, data: HookData<T>) {
        return await this[hookName]?.(data as any) as ReturnType<this[T]>;
    }

    async handleError<T extends ErrorHookName>(hookName: T, data: Omit<HookData<T>, 'error'> & {error: unknown}) {
        if(!(data.error instanceof Error))
            throw data.error;

        await this.run(hookName, data as HookData<T>);
    }

    async errorHookExecutor<T extends ErrorHookName>(hookName: T, data: HookData<T>) {
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
        });

        if(shouldSuppress)
            return;

        throw error;
    }

    async beforeCommandValidation(data: HookData<BeforeCommandValidationHook>) {
        let error: Error | null = null;
        const returnValue = {
            payload: data.payload,
            skip: false
        };

        await this.#callHooks('beforeCommandValidation', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            if(result.payload !== undefined)
            {
                returnValue.payload = result.payload;
                data.payload = returnValue.payload;
            }
            if(result.skip !== undefined)
                returnValue.skip = result.skip;
        });

        if(error)
            throw error;

        return returnValue;
    }

    async onCommandValidationError(data: HookData<OnCommandValidationErrorHook>) {
        return this.errorHookExecutor('onCommandValidationError', data);
    }

    async beforeCommandExecution(data: HookData<BeforeCommandExecutionHook>) {
        let error: Error | null = null;
        const returnValue = {
            payload: data.payload,
            state: data.state,
            context: data.context
        };
        const returnKeys = Object.keys(returnValue) as (keyof typeof returnValue)[];

        await this.#callHooks('beforeCommandExecution', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            returnKeys.forEach(key => {
                if(key in result)
                {
                    returnValue[key] = result[key] as any;
                    data[key] = returnValue[key] as any;
                }
            });
        });

        if(error)
            throw error;

        return returnValue;
    }

    async onCommandExecutionError(data: HookData<OnCommandExecutionErrorHook>) {
        return this.errorHookExecutor('onCommandExecutionError', data);
    }

    async afterCommandExecution(data: HookData<AfterCommandExecutionHook>) {
        let error: Error | null = null;
        let stateUpdate = data.stateUpdate;

        await this.#callHooks('afterCommandExecution', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            if(result.stateUpdate !== undefined)
            {
                stateUpdate = result.stateUpdate;
                data.stateUpdate = stateUpdate;
            }
        });

        if(error)
            throw error;

        return stateUpdate;
    }

    async onCommandError(data: HookData<OnCommandErrorHook>) {
        return this.errorHookExecutor('onCommandError', data);
    }

    async beforeReadModelValidation(data: HookData<BeforeReadModelValidationHook>) {
        let error: Error | null = null;
        const returnValue = {
            query: data.query,
            skip: false
        };

        await this.#callHooks('beforeReadModelValidation', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            if(result.query !== undefined)
            {
                returnValue.query = result.query;
                data.query = returnValue.query;
            }
            if(result.skip !== undefined)
                returnValue.skip = result.skip;
        });

        if(error)
            throw error;

        return returnValue;
    }

    async onReadModelValidationError(data: HookData<OnReadModelValidationErrorHook>) {
        return this.errorHookExecutor('onReadModelValidationError', data);
    }

    async beforeReadModelExecution(data: HookData<BeforeReadModelExecutionHook>) {
        let error: Error | null = null;
        const returnValue = {
            query: data.query,
            context: data.context
        };
        const returnKeys = Object.keys(returnValue) as (keyof typeof returnValue)[];

        await this.#callHooks('beforeReadModelExecution', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            returnKeys.forEach(key => {
                if(key in result)
                {
                    returnValue[key] = result[key] as any;
                    data[key] = returnValue[key] as any;
                }
            });
        });

        if(error)
            throw error;

        return returnValue;
    }

    async onReadModelExecutionError(data: HookData<OnReadModelExecutionErrorHook>) {
        return this.errorHookExecutor('onReadModelExecutionError', data);
    }

    async afterReadModelExecution(data: HookData<AfterReadModelExecutionHook>) {
        let error: Error | null = null;
        let returnValue = data.result;

        await this.#callHooks('afterReadModelExecution', data, async result => {
            if(!result)
                return;

            if(result.error)
                error = result.error;
            if(result.result !== undefined)
            {
                returnValue = result.result;
                data.result = returnValue;
            }
        });

        if(error)
            throw error;

        return returnValue;
    }

    async onReadModelError(data: HookData<OnReadModelErrorHook>) {
        return this.errorHookExecutor('onReadModelError', data);
    }
}

export default PluginRegistry;
