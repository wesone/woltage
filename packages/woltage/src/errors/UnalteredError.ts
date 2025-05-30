import BadRequestError from './BadRequestError.ts';

export default class UnalteredError extends BadRequestError
{
    constructor(message = 'Unaltered state') {
        super(message);
    }
}
