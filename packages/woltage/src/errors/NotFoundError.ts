import BasicError from './BasicError.ts';

export default class NotFoundError extends BasicError
{
    constructor(message = 'Not Found') {
        super(message, 404);
    }
}
