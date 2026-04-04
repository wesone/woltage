import {Event, z} from 'woltage';

// Version 2:
// Schema with renamed field (email -> emailAddress) and new field (department)
const schema = z.object({
    name: z.string(),
    emailAddress: z.email().meta({renamedFrom: 'email'}),
    department: z.string().default('Unknown')
});

export default class UserCreated extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 2;
}
