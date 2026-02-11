import z from 'zod';
import Event from '../../src/Event.ts';

export default <TVersion extends number = 1>(name: string, version = 1 as TVersion, schema: z.ZodType = z.unknown()) => (
    class EventMock extends Event {
        static toString() {
            return name;
        }
        static readonly schema = schema;
        static readonly version = version;
    }
);
