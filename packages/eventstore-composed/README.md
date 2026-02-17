# Woltage adapter - Composed Event Store

A composed event store adapter for Woltage.
It allows for splitting the event store into an event log (storage) and an event bus part.

## Usage

```typescript
import createWoltage from 'woltage';
import ComposedEventStore from '@woltage/eventstore-composed';

const woltage = await createWoltage({
    eventStore: {
        adapter: ComposedEventStore,
        args: [
            log: {
                adapter: /* ... */,
                args: []
            },
            bus: {
                adapter: /* ... */,
                args: []
            }
        ]
    },
    // ...
});
```
