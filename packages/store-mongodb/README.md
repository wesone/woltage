# Woltage adapter - MongoDB

A [MongoDB](https://www.mongodb.com/) store adapter for Woltage.

## Usage

```typescript
import createWoltage from 'woltage';
import MongoDBStore from '@woltage/store-mongodb';

const woltage = await createWoltage({
    stores: {
        mongodb: {
            adapter: MongoDBStore,
            args: [
                'mongodb+srv://user:p4ssw0rd@mongodb0.example.com/?authSource=admin&replicaSet=myRepl',
            ]
        }
    },
    // ...
});
```
See https://www.mongodb.com/docs/manual/reference/connection-string/ for more information about the connection string.