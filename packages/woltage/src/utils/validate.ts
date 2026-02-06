import z from 'zod';
import BadRequestError from '../errors/BadRequestError.ts';

export default function validate<TSchema extends z.ZodType>(schema: TSchema, data: any): z.infer<TSchema>
{
    try
    {
        return schema.parse(data);
    }
    catch(e)
    {
        if(e instanceof z.ZodError)
            throw new BadRequestError(JSON.stringify(e.issues));
        throw e;
    }
}
