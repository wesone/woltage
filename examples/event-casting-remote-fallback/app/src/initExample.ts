import {type Woltage, Event, emit, z} from 'woltage';
import UserAggregate from './aggregates/user/_Aggregate.ts';
import UserProjector from './projectors/UserProjector.ts';
import UserCreated from './events/user/UserCreated.ts';
import UserCreated2 from './events/user/UserCreated2.ts';
import User from './readModels/User.ts';
import {setTimeout} from 'node:timers/promises';

class DummyEvent extends Event
{
    static readonly schema = z.any();
    static readonly version = 1;
}

const schema = z.object({
    fullName: z.string().meta({renamedFrom: 'name'}),
    emailAddress: z.email(),
    department: z.string().default('Unknown'),
    phone: z.string().optional()
});
class UserCreated3 extends Event<typeof schema>
{
    static readonly name = 'UserCreated';
    static readonly schema = schema;
    static readonly version = 3;
}

export default async (woltage: Woltage) => {
    // Add default projection
    await woltage.addProjection('users', 1, UserProjector.name, UserProjector.version, 'mongo', true);

    // For demonstration purposes, we create a dummy event to execute the emit side effect
    const triggerEvent = new DummyEvent({aggregateId: 'user-0', payload: {}});

    // Create some users (mix of version 1, 2 and 3 events)
    await woltage.executeAsSideEffect(triggerEvent, emit, UserAggregate.type, [
        new UserCreated({id: '64cbf7e2-dae3-45a3-a7f9-ad6843ea5ceb', aggregateId: 'user-1', payload: {
            name: 'John Smith',
            email: 'jsmith@example.com'
        }}),
        new UserCreated2({id: '8b5914c6-8c73-41b2-86a4-d7a94c93c6f4', aggregateId: 'user-2', payload: {
            name: 'Steve Stevenson',
            emailAddress: 'sstevenson@example.com',
            department: 'Development'
        }}),
        // This event does not exist in the events folder and Woltage does not know its schema!
        // We pretend that this event was somehow produced by some other service
        new UserCreated3({id: '28fac505-c9c9-477c-8878-439514cb816c', aggregateId: 'user-3', payload: {
            fullName: 'Jeff Jefferson',
            emailAddress: 'jjefferson@example.com',
            department: 'Finance',
            phone: '1234567890'
        }})

    ]);
    console.log('Created some users...');

    do
    {
        const users = await woltage.executeQuery(User, 'list', undefined);
        // Since it takes some time for the events to be processed, we poll the list until we have users.
        // It is just for demonstration.
        if(users.length)
        {
            console.log('Existing users:', users);
            break;
        }
        await setTimeout(500);
    } while(true);
};
