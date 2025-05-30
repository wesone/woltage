import {ReadModel} from 'woltage';
import type UserProjector from '../projectors/UserProjector.ts';
import {z} from 'zod/v4';

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
        const result = await this.store.tables.users.find(query);
        if(!result.length)
            return null;
        return result[0];
    }
}
