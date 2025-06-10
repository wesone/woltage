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
