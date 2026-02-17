import KurrentDBEventStore from '@woltage/eventstore-kurrentdb';
import RedisStore from '@woltage/store-redis';
import MongoDBStore from '@woltage/store-mongodb';
import type {EventStoreAdapterConfig, StoreAdapterConfig} from 'woltage';

export const eventStore = Object.freeze({
    adapter: KurrentDBEventStore,
    args: [process.env.KURRENT_CONNECTION_STRING!]
}) satisfies EventStoreAdapterConfig<typeof KurrentDBEventStore>;

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
