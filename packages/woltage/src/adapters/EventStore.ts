import type {Readable} from 'stream';
import type Event from '../Event.ts';

export interface ReadableStream<T> extends Readable {
    addListener(event: 'data', listener: (data: T) => void): this;
    addListener(event: 'error', listener: (err: Error) => void): this;
    addListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
    on(event: 'data', listener: (data: T) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    once(event: 'data', listener: (data: T) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
    prependListener(event: 'data', listener: (data: T) => void): this;
    prependListener(event: 'error', listener: (err: Error) => void): this;
    prependListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
    prependOnceListener(event: 'data', listener: (data: T) => void): this;
    prependOnceListener(event: 'error', listener: (err: Error) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
    removeListener(event: 'data', listener: (data: T) => void): this;
    removeListener(event: 'error', listener: (err: Error) => void): this;
    removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export const START = 'start';
export const END = 'end';
export type ReadRevision = bigint | typeof START | typeof END;

export const STATE_NEW = 'state_new';
export const STATE_EXISTS = 'state_exists';
export type AppendRevision = bigint | typeof STATE_NEW | typeof STATE_EXISTS;

export const FORWARDS = 'forwards';
export const BACKWARDS = 'backwards';
export type Direction = typeof FORWARDS | typeof BACKWARDS;

export type ReadOptions = {
    /**
     * Default: `"start"`
     */
    fromRevision?: ReadRevision,
    /**
     * Default: `"forwards"`
     */
    direction?: Direction
};

export type Filter = {
    types?: string[]
};

export type SubscribeOptions = {
    /**
     * Default: `"start"`
     */
    fromRevision?: ReadRevision,
    filter?: Filter
};

export type SubscriptionStream = ReadableStream<Event>;

export interface IEventStore {
    connect(): Promise<void>
    close(force?: boolean): Promise<void>

    read(aggregateType: string, aggregateId: string, options?: ReadOptions): AsyncIterableIterator<Event>
    append(aggregateType: string, aggregateId: string, events: Event[], revision?: AppendRevision): Promise<void>
    subscribe(options?: SubscribeOptions): SubscriptionStream
    getLatestPosition(filter?: Filter): Promise<bigint | null>
};
