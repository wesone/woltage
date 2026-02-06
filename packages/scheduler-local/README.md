# Local Scheduler

A local scheduler that can be used for Woltage.

## Usage

```typescript
import createWoltage from 'woltage';
import LocalScheduler from '@woltage/scheduler-local';

const woltage = await createWoltage({
    scheduler: {
        adapter: LocalScheduler,
        args: [
            {retryFailedInvocations: true}
        ]
    },
    // ...
});
```
