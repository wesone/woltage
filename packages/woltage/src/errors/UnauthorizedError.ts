import BasicError from './BasicError.ts';

export default class UnauthorizedError extends BasicError
{
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}
