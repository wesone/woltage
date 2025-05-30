import BasicError from './BasicError.ts';

export default class ConflictError extends BasicError
{
    constructor(message = 'Conflict') {
        super(message, 409);
    }
}
