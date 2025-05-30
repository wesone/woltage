export default class BasicError extends Error
{
    status: number;

    constructor(message = 'Internal Error', status = 500) {
        super(message);
        this.status = status;
    }
}
