import BasicError from './BasicError.ts';

export default class GoneError extends BasicError
{
    constructor(message = 'Gone') {
        super(message, 410);
    }
}
