import z from 'zod';
import Event from '../../src/Event.ts';

export default (name: string, version: number = 1, schema: z.ZodType = z.unknown()) => (
    class UnknownEvent extends Event {
        static toString() {
            return name;
        }
        static version = version;
        static schema = schema;
    }
);
