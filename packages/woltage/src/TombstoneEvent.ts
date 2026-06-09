import type {StandardSchemaV1} from './adapters/standard-schema.ts';
import Event, {type EventConstructionData, type PayloadSchema} from './Event.ts';

const anySchema = {
    ['~standard']: {
        version: 1 as const,
        vendor: 'Woltage',
        validate: (payload: unknown) => ({value: payload})
    }
} as const;

export default class TombstoneEvent<TPayload extends PayloadSchema = any, TMeta = any> extends Event<TPayload, TMeta>
{
    static schema = anySchema as StandardSchemaV1;
    static version = 1;

    constructor(data?: EventConstructionData<TPayload, TMeta>)
    {
        super(data ?? {payload: {}});
    }
}
