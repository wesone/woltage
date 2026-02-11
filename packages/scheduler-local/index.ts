import {randomUUID} from 'crypto';

export type SchedulerCallback = (executeAt: Date, data: unknown) => Promise<void> | void;

export interface IScheduler {
    subscribe(callback: SchedulerCallback): Promise<void> | void
    unsubscribe(callback: SchedulerCallback): Promise<void> | void
    schedule(executeAt: Date, data: unknown): Promise<void> | void
};

export type Invocation = {
    id: string,
    executeAt: Date,
    data: unknown,
    retryCount: number
};

export type StorageDefinition = {
    load(): Promise<Invocation[] | null> | Invocation[] | null
    save(invocation: Invocation): Promise<void> | void
    delete(invocations: Invocation[]): Promise<void> | void
}

export type LocalSchedulerConfig = {
    /**
     * Provide a storage to persist invocations.
     *
     * If no storage is provided, invocations aren't preserved when application restarts.
     */
    storage?: StorageDefinition,
    /**
     * If `true`, failed invocations will be retried.
     *
     * Can be set to a number of max retries.
     *
     * Default: `false`
     */
    retryFailedInvocations?: boolean | number
}

export const MAX_TIMEOUT = 2147483647; // https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value -> last save value is 2**31-1

export default class LocalScheduler implements IScheduler {
    config: LocalSchedulerConfig;

    #callbacks: SchedulerCallback[] = [];
    #invocations: Invocation[] = [];
    #nextInvocationAt: number = 0;
    #timeout: NodeJS.Timeout | null = null;

    constructor(config?: LocalSchedulerConfig) {
        this.config = config ?? {};
    }

    async #init() {
        this.#invocations = await this.config.storage?.load() ?? [];
        this.#onInvocationHandled();
    }

    #onInvocationHandled() {
        if(this.#invocations.length)
            this.#setTimer(this.#invocations[0].executeAt.getTime());
    }

    #setTimer(timestamp: number) {
        if(this.#timeout)
            clearTimeout(this.#timeout);
        this.#nextInvocationAt = timestamp;
        this.#timeout = setTimeout(
            this.#invoke.bind(this),
            Math.min(this.#nextInvocationAt - Date.now(), MAX_TIMEOUT)
        );
    }

    async #execute({executeAt, data}: Invocation) {
        return Promise.all(this.#callbacks.map(callback => callback(executeAt, data)));
    }

    async #invoke() {
        const now = Date.now();

        // in this case the setTimeout delay was greater than MAX_TIMEOUT
        if(this.#nextInvocationAt - now > 0)
        {
            this.#setTimer(this.#nextInvocationAt);
            return;
        }

        const futureIndex = this.#invocations.findIndex(({executeAt}) => (executeAt.getTime() - now) > 0);
        const invocations = this.#invocations.splice(
            0,
            futureIndex === -1
                ? this.#invocations.length
                : futureIndex
        );

        const invocationResults = await Promise.allSettled(
            invocations.map(this.#execute.bind(this))
        );
        const fulfilledInvocations = invocations.filter((invocation, idx) =>
            invocationResults[idx].status === 'fulfilled'
            || (
                typeof this.config.retryFailedInvocations === 'number'
                && invocation.retryCount++ >= this.config.retryFailedInvocations
            )
        );
        if(this.config.retryFailedInvocations)
        {
            const fulfilledIds = fulfilledInvocations.map(({id}) => id);
            this.#invocations.unshift(
                ...invocations.filter(({id}) => fulfilledIds.indexOf(id) === -1)
            );
        }
        await this.config.storage?.delete(fulfilledInvocations);
        this.#onInvocationHandled();
    }

    async #addInvocation(invocation: Invocation) {
        if(!this.#invocations.length)
            this.#invocations.push(invocation);
        else
        {
            const afterIndex = this.#invocations.findIndex(({executeAt}) => (+executeAt - +invocation.executeAt) > 0);
            this.#invocations.splice(
                afterIndex === -1
                    ? this.#invocations.length
                    : afterIndex,
                0,
                invocation
            );
        }

        await this.config.storage?.save(invocation);
    }

    async subscribe(callback: SchedulerCallback) {
        if(!this.#callbacks.length)
            await this.#init();
        if(this.#callbacks.indexOf(callback) === -1)
            this.#callbacks.push(callback);
    }

    unsubscribe(callback: SchedulerCallback) {
        const index = this.#callbacks.indexOf(callback);
        if(index !== -1)
            this.#callbacks.splice(index, 1);
    }

    async schedule(executeAt: Date, data: unknown) {
        await this.#addInvocation({id: randomUUID(), executeAt, data, retryCount: 0});

        const timestamp = executeAt.getTime();
        if(!this.#nextInvocationAt || timestamp < this.#nextInvocationAt)
            this.#setTimer(timestamp);
    }
}
