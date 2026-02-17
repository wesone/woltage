# AMQP Scheduler

An AMQP scheduler that can be used for Woltage.

## Usage

```typescript
import createWoltage from 'woltage';
import AMQPScheduler from '@woltage/scheduler-amqp';

const woltage = await createWoltage({
    scheduler: {
        adapter: AMQPScheduler,
        args: [{
            url: 'amqp://localhost',
            queuePrefix: 'schdeuled',
            exchange: 'scheduled-exchange'
        }]
    },
    // ...
});
```
