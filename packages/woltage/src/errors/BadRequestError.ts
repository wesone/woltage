import BasicError from './BasicError.ts';

export default class BadRequestError extends BasicError
{
    constructor(message = 'Bad Request') {
        super(message, 400);
    }
}
