import z from 'zod';
import Event from '../../src/Event.ts';
import type {PayloadSchema} from '../../src/Event.ts';

export default <TVersion extends number = 1, TPayload extends PayloadSchema = any>(
    name: string,
    version = 1 as TVersion,
    schema: z.ZodType = z.unknown()
) => (
    class EventMock<TMeta = unknown> extends Event<TPayload, TMeta> {
        static toString() {
            return name;
        }
        static readonly schema = schema;
        static readonly version = version;
    }
);
