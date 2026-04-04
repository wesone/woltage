import {Event, z} from 'woltage';

// Version 3:
// Schema with renamed field (name -> fullName) and new field (phone)
const schema = z.object({
    fullName: z.string().meta({renamedFrom: 'name'}),
    emailAddress: z.email(),
    department: z.string().default('Unknown'),
    phone: z.string().optional()
});

export default class UserCreated extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 3;
}
