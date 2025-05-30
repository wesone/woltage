import BasicError from './BasicError.ts';

export default class ForbiddenError extends BasicError
{
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}
