import {ReadModel} from 'woltage';
import type UserProjector from '../projectors/UserProjector.ts';

export default class User extends ReadModel<UserProjector>
{
    projectionName = 'users';

    async list() {
        const cursor = this.tables.users.find();
        const docs = [];
        for await (const doc of cursor)
            docs.push(doc);
        return docs;
    }
}
