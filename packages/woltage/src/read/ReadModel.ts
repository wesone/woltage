import type Projector from './Projector.ts';
import {executionStorage} from '../localStorages.ts';
import NotFoundError from '../errors/NotFoundError.ts';
import validate from '../validate.ts';
import type z from 'zod';

abstract class ReadModel<TProjector extends Projector<any> = any>
{
    static getName(className: string) {
        return className.toLowerCase();
    }

    static toString() {
        return this.getName(this.name);
    }

    static get<T extends new(...args: any) => ReadModel>(this: T): InstanceType<T> {
        const readModelMap = executionStorage.getStore()?.readModelMap;
        if(!readModelMap)
            throw new Error('Read model is not callable in this context.');
        const readModelName = this.toString();
        if(!readModelMap[readModelName])
            throw new Error(`Read model ${readModelName} not found.`);
        return readModelMap[readModelName] as InstanceType<T>;
    }

    /**
     * The name of the projection this read model is connected to.
     */
    abstract readonly projectionName: string;

    /**
     * The schema registry is used to register a validation schema for a read model handler.
     * The key must be the name of one of the handler functions and the value is the schema.
     * The query parameter that will be passed to the handler function will be validated automatically.
     */
    readonly schemaRegistry: Partial<Record<string, z.ZodType>> = {};

    get store(): TProjector['store'] {
        const projectionMap = executionStorage.getStore()?.projectionMap;
        if(!projectionMap)
            throw new Error(`Read model for '${this.projectionName}' is not callable in this context.`);
        const projection = projectionMap.get(this.projectionName);
        if(!projection)
            throw new Error(`Projection '${this.projectionName}' not found.`);
        return projection.projector.store;
    }

    async call(handlerName: string, query: any) {
        if(!(handlerName in this) || Object.getOwnPropertyNames(ReadModel.prototype).includes(handlerName))
            throw new NotFoundError(`Handler '${handlerName}' of read model '${this.constructor.name}' not found.`);
        const handler = this[handlerName as keyof typeof this];
        if(handler instanceof Function)
        {
            if(handler.name in this.schemaRegistry)
                query = this.validate(this.schemaRegistry[handler.name]!, query);
            const context = Object.freeze({
                ...(executionStorage.getStore()?.context ?? {}),
            });
            return handler.bind(this)(query, context);
        }
    }

    validate = validate;
}

export default ReadModel;
