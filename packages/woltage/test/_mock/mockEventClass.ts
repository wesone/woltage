import z from 'zod';
import Event from '../../src/Event.ts';
import type {PayloadSchema} from '../../src/Event.ts';

export default function mockEventClass<TVersion extends number = 1, TPayload extends PayloadSchema = any>(
    name: string,
    version = 1 as TVersion,
    schema: z.ZodType = z.unknown()
)
{
    return class EventMock<TMeta = unknown> extends Event<TPayload, TMeta> {
        static toString() {
            return name;
        }
        static readonly schema = schema;
        static readonly version = version;
    };
};
