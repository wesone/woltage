# Woltage adapter - Redis

A [Redis](https://redis.io/) store adapter for Woltage.

## Usage

```typescript
import createWoltage from 'woltage';
import RedisStore from '@woltage/store-redis';

const woltage = await createWoltage({
    stores: {
        redis: {
            adapter: RedisStore,
            args: [
                {url: 'redis://user:p4ssw0rd@redis.example.com:6379'}
            ]
        }
    },
    // ...
});
```
See https://github.com/redis/node-redis/blob/master/docs/client-configuration.md for more information about the client options.