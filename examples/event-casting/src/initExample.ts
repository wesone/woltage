import {type Woltage, DuplicateAggregateError, EventCaster} from 'woltage';
import createLegacy from './aggregates/user/createLegacy.ts';
import create from './aggregates/user/create.ts';
import UserLegacyProjector from './projectors/UserLegacyProjector.ts';
import UserProjector from './projectors/UserProjector.ts';

import UserCreatedV1 from './events/user/UserCreated.ts';
import UserCreatedV2 from './events/user/UserCreated2.ts';

export default async (woltage: Woltage) => {
    // We should check if our existing event versions are compatible.
    // This would normally be part of a CI process or an automated test.
    // That way we can make sure that we can always upcast and downcast every event payload to the desired version.
    const upcastErrors = EventCaster.analyze(EventCaster.CASTING_DIRECTIONS.UP, UserCreatedV1.schema, UserCreatedV2.schema);
    const downcastErrors = EventCaster.analyze(EventCaster.CASTING_DIRECTIONS.DOWN, UserCreatedV2.schema, UserCreatedV1.schema);
    if(upcastErrors.length || downcastErrors.length)
    {
        console.log(
            `ERROR: ${UserCreatedV1.getDisplayName()} and ${UserCreatedV2.getDisplayName()} are not fully compatible`,
            JSON.stringify({
                upcastErrors,
                downcastErrors
            }, null, 2)
        );
        return;
    }

    // Add default projections
    const legacyUserProjection = await woltage.addProjection('users_legacy', 1, UserLegacyProjector.name, UserLegacyProjector.version, 'mongo', true);
    const userProjection = await woltage.addProjection('users', 1, UserProjector.name, UserProjector.version, 'mongo', true);

    // Create some users (mix of version 1 and version 2 events)
    await Promise.all([
        // We use createLegacy to get some version 1 events into our event store,
        // so we can demonstrate event casting in the projector.
        //
        // In a real-world application:
        // We could either still have some user.created@1 producers (third-party services, old commands, ...)
        // or we could have old version 1 events in our event store even though there won't be any new version 1 events.
        //
        // In both cases, we need to upcast these events for any handler that expects user.created@2 events.
        woltage.executeCommand(
            createLegacy,
            'user-1',
            {name: 'John Smith', email: 'jsmith@example.com'}
        ),
        woltage.executeCommand(
            createLegacy,
            'user-2',
            {name: 'Steve Stevenson', email: 'sstevenson@example.com'}
        ),

        // The up-to-date way of creating a user in this example is by using the create command.
        // It produces user.created@2 events.
        //
        // However there may be projections that were not updated yet (because maybe they don't process the new `department` field).
        // We need to downcast these version 2 events for the old projections to be able to process them.
        woltage.executeCommand(
            create,
            'user-3',
            {name: 'Thomas Vercetti', emailAddress: 'tvercetti@example.com', department: 'People'}
        ),
        woltage.executeCommand(
            create,
            'user-4',
            {name: 'Carl Johnson', emailAddress: 'cjohnson@example.com', department: 'Finance'}
        )
    ])
        .then(() => console.log('Created some users...'))
        .catch(async e => {
            if(!(e instanceof DuplicateAggregateError))
                throw e;

            // Get the runtime store tables directly
            const {tables: {users: legacyUsers}} = legacyUserProjection.projector as unknown as UserLegacyProjector;
            const {tables: {users}} = userProjection.projector as unknown as UserProjector;

            console.log(
                'Users already exist\n',
                'Legacy:\n',
                [
                    await legacyUsers.get({userId: 'user-1'}),
                    await legacyUsers.get({userId: 'user-2'}),
                    await legacyUsers.get({userId: 'user-3'}), // from version 2 event
                    await legacyUsers.get({userId: 'user-4'}) // from version 2 event
                ],
                'Current:\n',
                [
                    await users.get({userId: 'user-1'}), // from version 1 event
                    await users.get({userId: 'user-2'}), // from version 1 event
                    await users.get({userId: 'user-3'}),
                    await users.get({userId: 'user-4'})
                ]
            );
        });
};
