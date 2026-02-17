import amqplib from 'amqplib';
import {emit, Event, type SideEffectFunction, type Woltage} from 'woltage';
import SideEffectFailed from './events/SideEffectFailed.ts';

type SideEffectMessage = {
    origin: string,
    event: Event,
    args: any[],
    try: number
}

class SideEffectHelper
{
    static #queueName = 'side_effects';
    static #exchangeName = this.#queueName + '_exchange';
    static maxTries = 5;

    static #registeredSideEffects: Record<string, SideEffectFunction<any>> = {};
    static #senderChannel: amqplib.Channel;

    static async init(woltage: Woltage) {
        const conn = await amqplib.connect(process.env.AMQP_URL!);

        this.#senderChannel = await conn.createChannel();

        const receiverChannel = await conn.createChannel();
        await receiverChannel.assertExchange(this.#exchangeName, 'x-delayed-message', {arguments: {'x-delayed-type': 'fanout'}});
        await receiverChannel.assertQueue(this.#queueName, {arguments: {'x-single-active-consumer': true}});
        await receiverChannel.bindQueue(this.#queueName, this.#exchangeName, '#');
        await receiverChannel.consume(
            this.#queueName,
            async message => {
                if(message === null)
                {
                    console.log('Consumer cancelled by server');
                    return;
                }

                const data = JSON.parse(message.content.toString(), (k, v) => {
                    if(typeof v === 'string' && v.endsWith('n'))
                    {
                        const numberPart = v.slice(0, -1);
                        if(!isNaN(parseInt(numberPart)))
                            return BigInt(numberPart);
                    }
                    return v;
                }) as SideEffectMessage;

                const sf = this.#registeredSideEffects[data.origin];
                if(!sf)
                {
                    console.error(`Side effect '${data.origin}' not found.`, data);
                    receiverChannel.ack(message);
                    return;
                }

                try
                {
                    data.event = Event.fromJSON(data.event);
                    await woltage.executeAsSideEffect(data.event, sf, ...data.args);
                }
                catch(e)
                {
                    const error = e as Error;

                    data.try++;
                    console.error(`Side effect '${data.origin}' failure (${data.try}/${this.maxTries}).`, {error, data});

                    if(data.try < this.maxTries)
                    {
                        this.queue(data);
                        return;
                    }

                    await woltage.executeAsSideEffect(
                        data.event,
                        emit,
                        'side-effects',
                        new SideEffectFailed({
                            aggregateId: data.event.aggregateId,
                            payload: {
                                error: {
                                    message: error.message,
                                    name: error.name,
                                    stack: error.stack,
                                    cause: error.cause
                                },
                                data: {
                                    triggerEvent: data.event.toJSON(),
                                    args: data.args,
                                    try: data.try
                                }
                            }
                        })
                    );
                }
                finally
                {
                    receiverChannel.ack(message);
                }
            },
            {
                consumerTag: this.#queueName
            }
        );
    }

    static register<TArgs extends any[]>(origin: string, fn: SideEffectFunction<TArgs>) {
        if(this.#registeredSideEffects[origin] && this.#registeredSideEffects[origin] !== fn)
            throw new Error(`Ambigious side effect function in '${origin}' detected. Only one side effect function per file is allowed.`);
        this.#registeredSideEffects[origin] = fn;
    }

    // calculate an exponential backoff
    // after try 1 wait 12 seconds
    // after try 2 wait 144 seconds
    // after try 3 wait 28.8 minutes
    // after try 4 wait ~5 hours
    // ...
    static getDelay = (tryCount: number) => Math.min(1_800_000, 12 ** tryCount * 1000);

    static queue(message: SideEffectMessage) {
        const options: amqplib.Options.Publish = {};
        if(message.try)
            options.headers = {'x-delay': this.getDelay(message.try)};

        return this.#senderChannel.publish(
            this.#exchangeName,
            message.origin,
            Buffer.from(JSON.stringify(message, (k, v) => typeof v === 'bigint' ? `${v.toString()}n` : v)),
            options
        );
    };
}

export default SideEffectHelper;
