import KurrentDBEventStore from '@woltage/eventstore-kurrentdb';
import RedisStore from '@woltage/store-redis';
import MongoDBStore from '@woltage/store-mongodb';

export const eventStore = {
    adapter: KurrentDBEventStore,
    args: [process.env.KURRENT_CONNECTION_STRING]
};

export default {
    redis: {
        adapter: RedisStore,
        args: [
            {url: process.env.REDIS_CONNECTION_STRING}
        ]
    },
    mongo: {
        adapter: MongoDBStore,
        args: [
            process.env.MONGO_CONNECTION_STRING,
            // {}
        ]
    }
};
