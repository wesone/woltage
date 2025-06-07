# Woltage adapter - PostgreSQL

A [PostgreSQL](https://www.postgresql.org/) store adapter for Woltage that uses [pg](https://www.npmjs.com/package/pg) under the hood.

## Usage

```typescript
import createWoltage from 'woltage';
import PostgreSQLStore from '@woltage/store-postgres';

const woltage = await createWoltage({
    stores: {
        postgres: {
            adapter: PostgreSQLStore,
            args: [
                {
                    user: 'user',
                    password: 'p4ssw0rd',
                    host: 'postgres.example.com',
                    port: 5432,
                    database: 'db'
                },
                {
                   createTables: false
                }
            ]
        }
    },
    // ...
});
```
The first argument to pass to the adapter is a [node-postgres config](https://node-postgres.com/apis/pool).

As second argument you may pass an adapter config:
Property | Type | Description
:--- | :--- | :---
createTables | boolean | If `true`, tables will be automatically created on startup if they do not exist yet. Pass `false` if you want to handle the creation of tables yourself.<br>Default: `true`

When you define the schema for the table, you may add the `dataType` property to the meta data of a field. This way you can - for example - use `varchar` for a string type instead of `text` (which is the default):
```typescript
{
    key: z.object({
        // VARCHAR(36)
        id: z.uuid().meta({dataType: 'varchar(36)'})
    }),
    schema: z.object({
        // UUID
        foreignId: z.uuid(),
        // VARCHAR(254)
        email: z.email().meta({dataType: 'varchar(254)'}),
        // VARCHAR(128)
        shortDescription: z.string().meta({dataType: 'varchar(128)'}),
        // TEXT
        description: z.string().optional()
    })
}
```
