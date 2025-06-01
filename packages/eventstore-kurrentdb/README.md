# Woltage adapter - KurrentDB

A [KurrentDB](https://www.kurrent.io/) event store adapter for Woltage.

## Usage

```typescript
import createWoltage from 'woltage';
import KurrentDBEventStore from '@woltage/eventstore-kurrentdb';

const woltage = await createWoltage({
    eventStore: {
        adapter: KurrentDBEventStore,
        args: [
            'kurrentdb+discover://admin:p4ssw0rd@cluster.dns.name:2113'
        ]
    },
    // ...
});
```
See https://docs.kurrent.io/clients/grpc/getting-started.html#connection-string for more information about the connection string.