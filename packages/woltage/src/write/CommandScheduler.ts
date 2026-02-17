import type {IScheduler, SchedulerCallback} from '../adapters/Scheduler.ts';
import type {SchedulerAdapterConfig} from '../WoltageConfig.ts';
import {constructAdapter} from '../utils/adapterUtils.ts';

class CommandScheduler
{
    scheduler;
    callback;
    #isRunning = false;

    constructor(adapterConfig: SchedulerAdapterConfig, callback: SchedulerCallback) {
        this.scheduler = constructAdapter<new(...args: any) => IScheduler>(adapterConfig);
        this.callback = callback;
    }

    async start() {
        if(this.#isRunning)
            return;

        this.#isRunning = true;
        await this.scheduler.subscribe(this.callback);
    }

    async stop() {
        if(!this.#isRunning)
            return;

        this.#isRunning = false;
        await this.scheduler.unsubscribe(this.callback);
    }

    schedule(...args: Parameters<IScheduler['schedule']>) {
        return this.scheduler.schedule(...args);
    }
}

export default CommandScheduler;
