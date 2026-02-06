export type SchedulerCallback = (executeAt: Date, data: unknown) => Promise<void> | void;

export interface IScheduler {
    subscribe(callback: SchedulerCallback): Promise<void> | void
    unsubscribe(callback: SchedulerCallback): Promise<void> | void
    schedule(executeAt: Date, data: unknown): Promise<void> | void
};
