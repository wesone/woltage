# Woltage

A CQRS and Event-Sourcing Framework.

## Contents
* [Get started](#get-started)
* [Config](#config)
* [Event](#event)
    * [Type](#type)
    * [Version](#version)
    * [Meta Data](#meta-data)
* [Aggregate](#aggregate)
    * [Aggregate Projector](#aggregate-projector)
    * [Command](#command)
    * [Using Read Models](#using-read-models)
* [Projection](#projection)
    * [Version](#version-1)
    * [Projector](#projector)
    * [Side Effect](#side-effect)
* [Read Model](#read-model)
    * [Handler](#handler)
    * [schemaRegistry](#schemaregistry)
* [Adapter](#adapter)
    * [Event Store](#event-store)
    * [Store](#store)
* [Woltage Instance](#woltage-instance)

## Get started

Install the `woltage` package:
```sh
$ npm i woltage
```

Woltage relies on [adapters](#adapter) for handling data. You can build your own adapters that implement the appropriate interfaces ([`IEventStore`](#event-store), [`IStore`](#store)) or you can use existing adapters.
For example:
```sh
$ npm i @woltage/eventstore-kurrentdb @woltage/store-redis @woltage/store-mongodb
```

Then you can create a [Woltage instance](#woltage-instance):
```typescript
import createWoltage from 'woltage';
import KurrentDBEventStore from '@woltage/eventstore-kurrentdb';
import RedisStore from '@woltage/store-redis';
import MongoDBStore from '@woltage/store-mongodb';

const stores = {
    redis: {
        adapter: RedisStore,
        args: [{url: process.env.REDIS_CONNECTION_STRING}]
    },
    mongo: {
        adapter: MongoDBStore,
        args: [process.env.MONGO_CONNECTION_STRING]
    }
};

const woltage = await createWoltage({
    eventStore: {
        adapter: KurrentDBEventStore,
        args: [process.env.KURRENT_CONNECTION_STRING]
    },
    eventClasses: import.meta.dirname + '/events',
    aggregates: import.meta.dirname + '/aggregates',
    projectorClasses: import.meta.dirname + '/projectors',
    readModelClasses: import.meta.dirname + '/readModels',
    internalStore: stores.redis,
    stores 
});
```

You can combine the Woltage instance with an API.
A basic example with [Express](https://expressjs.com/) could be:
```typescript
import createWoltage from 'woltage';
import express from 'express';

// ...

const app = express();

app.post('/:aggregateName/:aggregateId/:commandName', async (req, res) => {
    const {aggregateName, aggregateId, commandName} = req.params;
    await woltage.executeCommand(
        aggregateName, 
        aggregateId, 
        commandName, 
        req.body
    );
    res.status(200).end();
});

app.get('/:readModelName/:handlerName', async (req, res) => {
    const {readModelName, handlerName} = req.params;
    const result = await woltage.executeQuery(
        readModelName,
        handlerName,
        req.query
    );
    res.json(result).end();
});

const port = 3000;
app.listen(port, () => {
    console.log(`Application started on port ${port}...`);
})
```

## Config

To create a Woltage instance, you need to pass a config. It has the following properties:

Property | Type | Description
:--- | :--- | :---
[eventStore](#event-store) | `{adapter: IEventStore, args?: any[]}` | The event store adapter to use.
[eventClasses](#event) | `(typeof Event)[] \| string` | An array of event classes or a path to a directory to import event classes from. *
[aggregates](#aggregate) | `Aggregate[] \| string` | An array of aggregate instances or a path to a directory to import aggregates from. *
[projectorClasses](#projector) | `(typeof Projector)[] \| string` | An array of projector classes or a path to a directory to import projector classes from. *
[readModelClasses?](#read-model) | `(typeof ReadModel)[] \| string` | An array of read model classes or a path to a directory to import read model classes from. *
[internalStore](#store) | `{adapter: IStore, args?: any[]}` | A store adapter that is used to store internal data.
[stores?](#store) | `Record<string, {adapter: IStore, args?: any[]}>` | A list of store adapters that can be used for projections. The keys are arbitrary names for the adapters.
autostart? | `boolean` | Boolean indicating if Woltage should start automatically after creation. Use [`woltage.start()`](#start) to start manually.<br>Default: `true`

> \* Important: if the directory (or a subdirectory) contains other modules, these modules will be imported too which could lead to side effects.

## Event

Every change to the state of the application is captured in an event. In Woltage each event has a schema (more precisely a [Zod](https://zod.dev/) schema) that defines how the event's payload looks like. To define an event, extend the Woltage event class:
```typescript
import {Event, z} from 'woltage';

const schema = z.object({
    email: z.email(),
    firstName: z.string(),
    lastName: z.string(),
    passwordHash: z.string()
});

export default class UserRegistered extends Event<typeof schema>
{
    static schema = schema;
    static version = 1;
}
```

### Type

The name of the class is automatically translated to the event type (`event.type`, `EventClass.type`, `EventClass.toString()`).

For example, the class `UserRegistered` has the event type `user.registered`.

The class `OrderShipmentPrepared` has the event type `order.shipment.prepared`.

### Version

An event class also has a `version` property. Thus there can be different versions of the exact same event type. Why? It is used for schema evolution.

- The problem: when you change the schema of an existing event class, you probably have historical events inside the event store that were created with the old schema. Your event handlers need to be able to process every possible schema of that event type.

- The solution: with the version property, you will never change that event class and instead create a new event class with the updated schema and set the version property to `2`.

### Meta Data

An event can also have meta data that you don't want to be part of the payload itself. For example, inside the event's meta data you want to store the user ID of the user that created the event. You could define it this way:
```typescript
import {Event, z} from 'woltage';

type TMeta = {
    userId: string
};

const schema = z.object({
    shippingCompany: z.enum(['FedEx', 'UPS', 'USPS', 'DHL']),
    trackingNumber: z.string().optional()
});

export default class OrderFulfilled extends Event<typeof schema, TMeta>
{
    static schema = schema;
    static version = 1;
}
```
```typescript
// when producing the event...

// ID of the order that was fulfilled
const aggregateId = '42849a46-df5f-487c-863d-ed4721ff2541'; 
// the payload of the event
const payload = {shippingCompany: 'FedEx'};
// the meta data containing the user ID of the current user
const meta = {userId: getLoggedInUser().id};

const event = new OrderFulfilled({
    aggregateId,
    payload,
    meta
});
```

If you want to automatically fill in the meta data for every event, you may create a general event class that extends the Woltage event class:
```typescript
import {
    Event as WoltageEvent, 
    type EventConstructionData, 
    type z
} from 'woltage';

type TMeta = {
    userId: string
};

export default class Event<TPayload extends z.ZodType> extends WoltageEvent<TPayload, TMeta>
{
    constructor(data: EventConstructionData<TPayload, TMeta>, shouldValidate?: boolean) {
        if(!data.meta)
            data.meta = {userId: getLoggedInUser().id};
        super(data, shouldValidate);
    }
}
```
> Important: the constructor will also be called for existing serialized events. So you need to differentiate between the creation of a new event and the instantiation of an existing event.

And let every event class extend from that class:
```typescript
import {z} from 'woltage';
import Event from '../Event.ts';

const schema = z.object({
    shippingCompany: z.enum(['FedEx', 'UPS', 'USPS', 'DHL']),
    trackingNumber: z.string().optional()
});

export default class OrderFulfilled extends Event<typeof schema>
{
    static schema = schema;
    static version = 1;
}
```

## Aggregate

When it comes to producing events, Woltage uses the aggregate pattern.
An aggregate needs to have a name and an [aggregate projector](#aggregate-projector). After the aggregate was created, you can register [commands](#command) to it. These commands can produce events. An example for an order aggregate:
```typescript
import {
    Aggregate, 
    z,
    DuplicateAggregateError,
    NotFoundError
} from 'woltage';
import OrderPlaced from './events/OrderPlaced.ts';
import OrderFulfilled from './events/OrderFulfilled.ts';

const itemSchema = z.object({
    sku: z.string(),
    quantity: z.int().min(1),
    price: z.number()
});
const addressSchema = z.object({
    street: z.string(),
    houseNumber: z.string(),
    postalCode: z.string(),
    city: z.string()
});

const orderAggregate = Aggregate.create('order', {
    $init() {
        return {
            placedAt: 0
            items: [] as z.infer<typeof itemSchema>[],
            shippingAddress: {/* ... */},
            billingAddress: {/* ... */},
            shippingCompany: '',
            trackingNumber: null as string | null
        };
    },
    [OrderPlaced.identity](state, event: OrderPlaced) {
        return {
            ...state,
            ...event.payload,
            placedAt: event.timestamp
        };
    },
    [OrderFulfilled.identity](state, event: OrderFulfilled) {
        state.shippingCompany = event.payload.shippingCompany;
        if(event.payload.trackingNumber)
            state.trackingNumber = event.payload.trackingNumber;
        return state;
    }
});

orderAggregate.registerCommand(
    z.object({
        items: z.array(itemSchema).min(1),
        shippingAddress: addressSchema,
        billingAddress: addressSchema
    }),
    async function placeOrder(state, payload) {
        if(state.placedAt)
            throw new DuplicateAggregateError();

        // in this case the command payload is equal to the event payload
        return new OrderPlaced({
            payload
        });
    }
);

orderAggregate.registerCommand(
    z.object({
        shippingCompany: z.enum(['FedEx', 'UPS', 'USPS', 'DHL']),
        trackingNumber: z.string().optional()
    }),
    async function fulfillOrder(state, payload, context) {
        if(!state.placedAt)
            throw new NotFoundError(`Order ${context.aggregateId} not found.`);

        // in this case the command payload is equal to the event payload
        return new OrderFulfilled({
            payload
        });
    }
);
```

### Aggregate Projector

Whenever a [command](#command) is executed, the current state of the aggregate is calculated and passed to the command. How the state should look is defined by an aggregate projector. It acts like a reducer that reduces all events of the requested aggregate ID to a state.

It can have the following properties:
Property | Type | Description
:--- | :--- | :---
$init? | `() => any` | The init function returns an initial state.
$all? | `(state: any, event: Event) => any` | This function will be called for each event that has no designated event handler and should return the new state.
[EventClass.identity] | `(state: any, event: Event) => any` | An event handler of a specific event type and version.

### Command

A command is the instruction to the system to change an aggregate's state. It decides if an event (or events) should be created or not and it will receive the [aggregate's state](#aggregate-projector) to make that decision.

To register a command use the `registerCommand` method of the aggregate.
- You can pass a [Zod](https://zod.dev/) schema along with the command handler to automatically validate the command payload.
- The name of the command is simply the name of the function, that you pass as command handler. You can alternatively pass a command name if the command handler is an anonymous function or if you just want to use a different name.

The command handler has the form:

`(state: any, payload: any, context: {aggregateId: string}) => Promise<Event | Event[] | void> | Event | Event[] | void;`

> Important: Optimistic Concurrency Control is used to handle the parallel execution of commands. If two commands run in parallel for the same aggregate ID, both start with the same state but one command may add a new event and the other one would then operate with an outdated state. With the optimistic concurrency control, that other command will fail.

### Using Read Models

In case the state that will be passed to the command handler is not sufficient (maybe the command handler needs to read from a different aggregate), you can call read models inside the command handler.
```typescript
import {z, ConflictError, DuplicateAggregateError} from 'woltage';
import userAggregate from './userAggregate.ts';
import {generatePasswordHash} from '../utils/password.ts';
import User from '../readModels/User.ts';
import UserRegistered from '../events/UserRegistered.ts';

userAggregate.registerCommand(
    z.object({
        email: z.email(),
        firstName: z.string(),
        lastName: z.string(),
        password: z.string()
    }),
    async function register(
        {isRegistered},
        payload
    ) {
        if(isRegistered)
            throw new DuplicateAggregateError();

        if(!await User.get().isEmailAddressAvailable(payload.email))
            throw new ConflictError('Email address is not available.');

        const passwordHash = await generatePasswordHash(payload.password);

        return new UserRegistered({
            payload: {
                ...payload,
                passwordHash
            }
        });
    }
);
```
Use the static `get` method of the read model's class to retrieve the runtime read model instance.

> Important: ReadModelClass.get() only works inside a Woltage context. When you want to use the read model outside of Woltage, use [`woltage.executeQuery`](#executequery) instead.

## Projection

A projection is used to bring the events into a form that is optimized for reading/querying. A projection has a name and a [version](#version-1) and uses a [projector](#projector). As soon as a projection was added, it will start to replay all existing events (the projection is in replay mode while doing this) and then waits for new events. To add a projection use [`woltage.addProjection`](#addprojection).

### Version

You can add multiple projections with the same name but with different versions. Each projection can use a different projector. When using read models, only one of the projection version is used by the read model (use [`woltage.setProjectionActive`](#setprojectionactive) to change the active version).

Why? To prevent downtimes. It is useful whenever you need to update a projector. This way you can add the new projection with the new projector but still use the old projection while the new one is replaying (which may take some time). As soon as the new projection is up-to-date you can switch to the new projection (and delete the old one). 

### Projector

A projector is basically a list of event handlers that is used by a projection. The projector operates on a [store](#store):
```typescript
import {Projector, z} from 'woltage';
import UserRegistered from '../events/user/UserRegistered.ts';

const schema = {
    emails: {
        key: z.object({
            email: z.email()
        }),
        schema: z.object({
            userId: z.uuid(),
            registeredAt: z.number()
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static schema = schema;
    static version = 1;

    async [UserRegistered.identity](event: UserRegistered) {
        const {emails} = this.store.tables;

        if(await emails.get({email: event.payload.email}))
            return;

        await emails.set({
            email: event.payload.email,
            userId: event.aggregateId,
            registeredAt: event.timestamp
        });
    }
}
```

> Important: Woltage allows for Polyglot Persistence. When using TypeScript, you can redeclare the store type and use the adapter specific features along with the methods of the store interface.

```typescript
import {Projector, z} from 'woltage';
import type MongoDBStore from '@woltage/store-mongodb';
import UserRegistered from '../events/user/UserRegistered.ts';

const schema = {
    emails: {
        key: z.object({
            email: z.email()
        }),
        schema: z.object({
            userId: z.uuid(),
            registeredAt: z.number()
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static schema = schema;
    static version = 1;

    declare store: MongoDBStore<typeof schema>;

    async [UserRegistered.identity](event: UserRegistered) {
        const {emails} = this.store.tables;

        if(await emails.get({email: event.payload.email}))
            return;

        // https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne/
        await emails.insertOne({
            email: event.payload.email,
            userId: event.aggregateId,
            registeredAt: event.timestamp
        });
    }
}
```

> Important: when you add a projection, make sure to use a store adapter that is compatible with the projector.

### Side Effect

To build your business logic, you may need to execute side effects. For example, after a new user registered, you want to respond to the `user.registered` event and send a confirmation email to the user or maybe your application needs to call a third party API.

- The problem: when calling the function for sending an email is part of the event handler logic, it will execute also during a replay. Maybe someday you need to change the projection logic and suddenly all of your users will receive confirmation emails even though their accounts are years old.

- The solution: wrap your functions with `sideEffect()` and call that instead. It has the same signature than before, but the side effect will not execute your function during a replay.

```typescript
import {Projector, z, sideEffect} from 'woltage';
import UserRegistered from '../events/user/UserRegistered.ts';
import sendMail, {templateConfirmationEmail} from '../mailer.ts';

const sendConfirmationEmail = sideEffect(
    async ({email}: {email: string}) => {
        await sendMail(email, templateConfirmationEmail);
    }
);

const schema = {
    emails: {
        key: z.object({
            email: z.email()
        }),
        schema: z.object({
            userId: z.uuid(),
            registeredAt: z.number()
        })
    }
};

export default class UserProjector extends Projector<typeof schema>
{
    static schema = schema;
    static version = 1;

    async [UserRegistered.identity](event: UserRegistered) {
        const {emails} = this.store.tables;

        if(await emails.get({email: event.payload.email}))
            return;

        await emails.set({
            email: event.payload.email,
            userId: event.aggregateId,
            registeredAt: event.timestamp
        });
        await sendConfirmationEmail({email: event.payload.email});
    }
}
```

Due to the fact that a side effect is executed conditionally, you can not return any data from a side effect.

If you want to process data returned from a third party API, you would want to put that data in a new event. To create a new event from a side effect, you use the `emit` function (which itself is also a side effect):
```typescript
import {sideEffect, emit} from 'woltage';
import UserConfirmationEmailSent from '../events/user/UserConfirmationEmailSent.ts';
import UserConfirmationEmailSendingFailed from '../events/user/UserConfirmationEmailSendingFailed.ts';
import sendMail, {templateConfirmationEmail} from '../mailer.ts';

const sendConfirmationEmail = sideEffect(
    async ({userId, email}: {userId: string, email: string}) => {
        const {mailId, errorMessage} = await sendMail(email, templateConfirmationEmail);
        const event = errorMessage === undefined
            ? new UserConfirmationEmailSent({
                aggregateId: userId,
                payload: {mailId}
            })
            : new UserConfirmationEmailSendingFailed({
                aggregateId: userId,
                payload: {errorMessage}
            });
        await emit({aggregateName: 'user', events: event});
    }
);
```

## Read Model

A read model is used to read/query the [projections](#projection). It is bound to a projection name and has access to the [store](#store) of the projection's active version (use [`woltage.setProjectionActive`](#setprojectionactive) to change the active version).

> When using TypeScript, you can provide the underlying projector type to have the store's type information.

```typescript
import {ReadModel, z} from 'woltage';
import type UserProjector from '../projectors/UserProjector.ts';

export default class User extends ReadModel<UserProjector>
{
    projectionName = 'user';
    schemaRegistry = {
        findOne: z.union([
            z.object({
                email: z.string()
            }),
            z.object({
                id: z.string()
            })
        ])
    };

    async isEmailAddressAvailable(email: string) {
        return !(await this.store.tables.emails.get({email}));
    }

    async findOne(query: z.infer<this['schemaRegistry']['findOne']>) {
        return await this.store.tables.users.findOne(query);
    }
}
```

### Handler

A read model handler function is simply a method of the read model class. It can have any parameters and may return any value.

However, if you want to call the handler via [`woltage.executeQuery`](#executequery), it will receive a `query` parameter and a `context` parameter. 

### schemaRegistry

You can optionally add read model methods to the read model's schema registry. When doing so, the `query` parameter of the read model method is automatically validated when called via [`woltage.executeQuery`](#executequery), so the method itself does not need to handle the validation.

> Important: the schemaRegistry is not used when the read model was accessed through `ReadModelClass.get()`.

## Adapter

Woltage supports adapters to make use of different event store implementations and different database technologies.

### Event Store

An event store adapter needs to implement the `IEventStore` interface.

### Store

You can use many different store technologies inside the same application. So the used database for a projection can depend on the data the projection should handle. For example, a simple projection that is frequently read may use a Redis, while a projection that needs to allow complex querying could use a MongoDB.
A store adapter needs to implement the `IStore` interface but can have additional functionality.

## Woltage Instance



### executeCommand

`async executeCommand(aggregateName: string, aggregateId: string, commandName: string, payload: any, context?: any): Promise<void>`

To execute a [command](#command) of an aggregate. If the optional `context` parameter was provided, it will be added to the context parameter of the command.

### executeQuery

`async executeQuery(readModelName: string, handlerName: string, query: any, context?: any): Promise<any>`

To execute a [read model handler](#handler). If the optional `context` parameter was provided, it will be added to the context parameter of the read model handler.

### addProjection

`async addProjection(projectionName: string, projectionVersion: number, projectorName: string, projectorVersion: number, storeName: string): Promise<void>`

To add a new projection. The `storeName` parameter is one of the keys of the config's `stores` property.

### setProjectionActive

`async setProjectionActive(projectionName: string, projectionVersion: number, force = false): Promise<void>`

To update the active version of a projection name. You can not switch to a projection that is not tracking live events (because it is replaying) unless you set the optional `force` parameter to `true`.

### getProjections

`getProjections(): {[projectionId: string]: Projection}`

To retrieve all registered projections.

### getProjection

`getProjection(projectionName: string, projectionVersion: number): Projection | undefined`

To get a specific projection.

### removeProjection

`async removeProjection(projectionName: string, projectionVersion: number, force = false): Promise<void>`

To remove a projection. You can not remove a projection that is currently active unless you set the optional `force` parameter to `true`.

> Important: removing a projection will not delete it's data from the store.

### start

`async start(): Promise<void>`

To start the application. 

### stop

`async stop(): Promise<void>`

To gracefully stop the application.
