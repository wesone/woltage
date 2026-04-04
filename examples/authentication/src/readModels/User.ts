import {ReadModel, z} from 'woltage';
import type UserProjector from '../projectors/UserProjector.ts';

export default class User extends ReadModel<UserProjector>
{
    projectionName = 'users';
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
        return !(await this.tables.emails.get({email}));
    }

    async findOne(query: z.infer<this['schemaRegistry']['findOne']>) {
        return this.tables.users.findOne(query);
    }

    async list() {
        const cursor = this.tables.users.find();
        const docs = [];
        for await (const doc of cursor)
            docs.push(doc);
        return docs;
    }
}
