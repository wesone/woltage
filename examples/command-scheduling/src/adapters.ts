import KurrentDBEventStore from '@woltage/eventstore-kurrentdb';
import RedisStore from '@woltage/store-redis';
import MongoDBStore from '@woltage/store-mongodb';
import AMQPScheduler from '@woltage/scheduler-amqp';
import type {EventStoreAdapterConfig, SchedulerAdapterConfig, StoreAdapterConfig} from 'woltage';

export const eventStore: EventStoreAdapterConfig<typeof KurrentDBEventStore> = Object.freeze({
    adapter: KurrentDBEventStore,
    args: [process.env.KURRENT_CONNECTION_STRING!]
});

export const stores = Object.freeze({
    redis: {
        adapter: RedisStore,
        args: [
            {url: process.env.REDIS_CONNECTION_STRING}
        ]
    } satisfies StoreAdapterConfig<typeof RedisStore>,
    mongo: {
        adapter: MongoDBStore,
        args: [
            process.env.MONGO_CONNECTION_STRING!
        ]
    } satisfies StoreAdapterConfig<typeof MongoDBStore>
});

export const scheduler: SchedulerAdapterConfig<typeof AMQPScheduler> = Object.freeze({
    adapter: AMQPScheduler,
    args: [{
        url: process.env.AMQP_URL!,
        queue: 'scheduled-commands',
        exchange: 'scheduled-commands-exchange'
    }]
});
