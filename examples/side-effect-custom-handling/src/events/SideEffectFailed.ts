import {Event, z} from 'woltage';

const schema = z.object({
    error: z.object({
        message: z.string(),
        name: z.string(),
        stack: z.string().optional(),
        cause: z.unknown()
    }),
    data: z.object({
        triggerEvent: z.looseObject({
            type: z.string(),
            version: z.number()
        }),
        args: z.array(z.any()).optional(),
        try: z.number()
    })
});

export default class SideEffectFailed extends Event<typeof schema>
{
    static readonly schema = schema;
    static readonly version = 1;
}

