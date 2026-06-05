import type Projector from './Projector.ts';
import {executionStorage} from '../localStorages.ts';
import NotFoundError from '../errors/NotFoundError.ts';
import validate from '../utils/validate.ts';
import type {StandardSchemaV1} from '../adapters/standard-schema.ts';

export type ReadModelContext<TContext extends object = Record<string, any>> = TContext & {
    // Framework specific properties
};

abstract class ReadModel<TProjector extends Projector<any> = any>
{
    static getName(className: string) {
        return className.toLowerCase();
    }

    static toString() {
        return this.getName(this.name);
    }

    /**
     * Returns the runtime read model instance when used inside a Woltage context (e.g. inside a command handler).
     */
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
    readonly schemaRegistry: Partial<Record<string, StandardSchemaV1>> = {};

    get store(): TProjector['store'] {
        const projectionMap = executionStorage.getStore()?.projectionMap;
        if(!projectionMap)
            throw new Error(`Read model for '${this.projectionName}' is not callable in this context.`);
        const projection = projectionMap.get(this.projectionName);
        if(!projection)
            throw new Error(`Projection '${this.projectionName}' not found.`);
        return projection.projector.store;
    }

    get tables(): TProjector['store']['tables'] {
        return this.store.tables;
    }

    async call(handlerName: string, query: any) {
        if(!(handlerName in this) || Object.getOwnPropertyNames(ReadModel.prototype).includes(handlerName))
            throw new NotFoundError(`Handler '${handlerName}' of read model '${this.constructor.name}' not found.`);

        const handler = this[handlerName as keyof this];
        if(!(handler instanceof Function))
            return;

        const {context, pluginRegistry} = executionStorage.getStore() ?? {};

        if(handlerName in this.schemaRegistry)
        {
            const beforeReadModelValidationResult = await pluginRegistry?.beforeReadModelValidation({
                readModel: this,
                handlerName,
                query,
                context
            });
            if(beforeReadModelValidationResult !== undefined)
                query = beforeReadModelValidationResult;

            try
            {
                query = await this.validate(this.schemaRegistry[handlerName]!, query);
            }
            catch(error)
            {
                if(!pluginRegistry)
                    throw error;

                await pluginRegistry?.handleError('onReadModelValidationError', {
                    readModel: this,
                    handlerName,
                    query,
                    context,
                    error
                });
            }
        }

        try
        {
            let readModelContext: ReadModelContext = {
                ...(context ?? {})
                // Framework specific properties
            };

            const beforeReadModelExecutionResult = await pluginRegistry?.run('beforeReadModelExecution', {
                readModel: this,
                handlerName,
                query,
                context: readModelContext
            });
            if(beforeReadModelExecutionResult !== undefined)
            {
                query = beforeReadModelExecutionResult.query;
                readModelContext = beforeReadModelExecutionResult.context;
            }

            let result;
            try
            {
                result = handler.bind(this)(query, readModelContext);
            }
            catch(error)
            {
                if(!pluginRegistry)
                    throw error;

                await pluginRegistry?.handleError('onReadModelExecutionError', {
                    readModel: this,
                    handlerName,
                    query,
                    context: readModelContext,
                    error
                });
            }

            const afterReadModelExecutionResult = await pluginRegistry?.run('afterReadModelExecution', {
                readModel: this,
                handlerName,
                query,
                context: readModelContext,
                result
            });
            if(afterReadModelExecutionResult !== undefined)
                result = afterReadModelExecutionResult;

            return result;
        }
        catch(error)
        {
            if(!pluginRegistry)
                throw error;

            await pluginRegistry?.handleError('onReadModelError', {
                readModel: this,
                handlerName,
                query,
                context,
                error
            });
        }
    }

    validate = validate;
}

export default ReadModel;
