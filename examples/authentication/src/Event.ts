import {Event as WoltageEvent, type EventConstructionData, type z} from 'woltage';
import apiStorage from './api/apiStorage.ts';

type TMeta = {
    userId: string | null
};

export default class Event<TPayload extends z.ZodType> extends WoltageEvent<TPayload, TMeta>
{
    constructor(data: EventConstructionData<TPayload, TMeta>, shouldValidate?: boolean) {
        if(!data.meta)
        {
            const {user} = apiStorage.getStore() ?? {user: {id: 'system'}};
            data.meta = {userId: user?.id};
        }
        super(data, shouldValidate);
    }
}
