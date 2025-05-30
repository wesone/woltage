import ConflictError from './ConflictError.ts';

export default class DuplicateAggregateError extends ConflictError
{
    constructor(message = 'Aggregate already exists') {
        super(message);
    }
}
