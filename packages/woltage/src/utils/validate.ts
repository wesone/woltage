import type {StandardSchemaV1} from '../adapters/standard-schema.ts';
import BadRequestError from '../errors/BadRequestError.ts';

export default async function validate<TSchema extends StandardSchemaV1>(schema: TSchema, data: unknown): Promise<StandardSchemaV1.InferOutput<TSchema>>
{
    const result = await schema['~standard'].validate(data);
    if(result.issues)
        throw new BadRequestError(JSON.stringify(result.issues, null, 2));
    return result.value;
}
