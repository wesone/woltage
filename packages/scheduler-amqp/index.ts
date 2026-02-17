import amqp, {Channel, ChannelWrapper, SetupFunc} from 'amqp-connection-manager';

export type SchedulerCallback = (executeAt: Date, data: unknown) => Promise<void> | void;

export interface IScheduler {
    subscribe(callback: SchedulerCallback): Promise<void> | void
    unsubscribe(callback: SchedulerCallback): Promise<void> | void
    schedule(executeAt: Date, data: unknown): Promise<void> | void
};

export type AMQPSchedulerConfig = {
    url: string | string[],
    options?: amqp.AmqpConnectionManagerOptions,
    queuePrefix: string,
    exchange: string
};

export default class AMQPScheduler implements IScheduler
{
    config: AMQPSchedulerConfig;
    connection;
    channelWrapper: ChannelWrapper;
    consumerSetups: WeakMap<SchedulerCallback, {setup: SetupFunc, consumerTag: string}> = new WeakMap();
    consumerCount = 0;

    constructor(config: AMQPSchedulerConfig) {
        this.config = config;
        this.connection = amqp.connect(config.url, config.options);

        this.channelWrapper = this.connection.createChannel({
            json: true,
            async setup(channel: Channel) {
                await channel.assertExchange(config.exchange, 'x-delayed-message', {arguments: {'x-delayed-type': 'fanout'}});
            }
        });
    }

    async subscribe(callback: SchedulerCallback) {
        const queue = `${this.config.queuePrefix}_${this.consumerCount}`;
        const exchange = this.config.exchange;
        const consumerSetups = this.consumerSetups;
        const setup = async (channel: Channel) => {
            await channel.assertQueue(queue, {arguments: {'x-single-active-consumer': true}});
            await channel.bindQueue(queue, exchange, '#');
            const {consumerTag} = await channel.consume(queue, async msg => {
                if(!msg)
                    return;
                const {executeAt, data} = JSON.parse(msg.content.toString());
                await callback(executeAt, data);
                channel.ack(msg);
            });
            consumerSetups.set(callback, {setup, consumerTag});
        };

        await this.channelWrapper.addSetup(setup);
        this.consumerCount++;
    }

    async unsubscribe(callback: SchedulerCallback) {
        const subscription = this.consumerSetups.get(callback);
        if(!subscription)
            return;
        const {setup, consumerTag} = subscription;
        await this.channelWrapper.removeSetup(setup, async (channel: Channel) => {
            // we keep the binding and the queue
            await channel.cancel(consumerTag);
        });
        this.consumerCount--;
    }

    async schedule(executeAt: Date, data: unknown) {
        await this.channelWrapper.publish(
            this.config.exchange,
            'scheduled-message',
            {executeAt, data},
            {
                headers: {'x-delay': executeAt.getTime() - Date.now()}
            }
        );
    }
}
