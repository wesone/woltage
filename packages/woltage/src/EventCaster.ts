import z from 'zod';
import type {StandardSchemaV1} from './adapters/standard-schema.ts';
import Event from './Event.ts';
import type {EventMap} from './eventMap.ts';

export function extractZodTypeInfo(schema: z.ZodType)
{
    const {success: isOptional, data: defaultValue} = schema.safeParse(undefined);
    const isNullable = schema.safeParse(null).success;

    let current = schema;
    while(
        ['optional', 'default', 'nullable'].includes(current.type)
        && 'unwrap' in current
        && typeof current.unwrap === 'function'
    )
    {
        const unwrapped = current.unwrap();
        if(unwrapped === current)
            break;
        current = unwrapped;
    }

    return {
        isOptional,
        isNullable,
        hasDefault: defaultValue !== undefined,
        defaultValue,
        innerSchema: current,
        type: current.type
    };
}

type TypeInfo = ReturnType<typeof extractZodTypeInfo>;

export interface CastingError {
    path: string[];
    message: string;
    details?: any;
}

export type CastingDirection = (typeof EventCaster.CASTING_DIRECTIONS)[keyof typeof EventCaster.CASTING_DIRECTIONS];

export type EventCastingFallback = (event: Event, targetVersion: number, strict?: boolean) => Promise<Event>;

interface EventCasterOptions {
    strict?: boolean;
    fallback?: EventCastingFallback;
}

export default class EventCaster
{
    static CASTING_DIRECTIONS = Object.freeze({
        UP: 'up',
        DOWN: 'down'
    });

    static CASTING_ERRORS = Object.freeze({
        UNSUPPORTED_SCHEMA: 'Unsupported schema type',
        TYPE_MISMATCH: 'Type mismatch',
        REQUIRED_FIELD_ADDED: 'Required field added',
        REQUIRED_FIELD_REMOVED: 'Required field removed',
        FIELD_NOW_REQUIRED: 'Field is now required and has no default',
        VARIANT_ADDED: 'Variant added',
        VARIANT_REMOVED: 'Variant removed',
        SCALAR_TYPE_WIDENED: 'Widened scalar type',
        SCALAR_TYPE_NARROWED: 'Narrowed scalar type'
    });

    static RECURSION_DEPTH = 20;

    eventMap: EventMap;
    options: EventCasterOptions;

    /**
     * Pushes an error to the errors array.
     */
    static #pushError(errors: CastingError[], path: string[], message: string, details?: any) {
        errors.push({path: [...path], message, details});
    }

    /**
     * Handlers for different schema types to analyze.
     * Each handler returns the errors array, allowing collection of all incompatibilities.
     */
    static readonly #ANALYZERS: Record<string, (this: typeof EventCaster, castingDirection: CastingDirection, sourceSchemaInfo: TypeInfo, targetSchemaInfo: TypeInfo, path: string[], errors: CastingError[], depth: number) => CastingError[]> = {
        object(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors, depth) {
            const sObj = (sourceSchemaInfo.innerSchema as z.ZodObject).shape;
            const tObj = (targetSchemaInfo.innerSchema as z.ZodObject).shape;

            // handle renamed properties via Zod metafield "renamedFrom"
            const renameFromTo = new Map<string,string>();
            const renameToFrom = new Map<string,string>();
            if(castingDirection === this.CASTING_DIRECTIONS.UP)
            {
                for(const [targetKey, targetSchema] of Object.entries<z.ZodType>(tObj))
                {
                    const renamedFrom = targetSchema.meta()?.renamedFrom;
                    if(typeof renamedFrom === 'string' && Object.hasOwn(sObj, renamedFrom))
                    {
                        renameFromTo.set(renamedFrom, targetKey);
                        renameToFrom.set(targetKey, renamedFrom);

                        const sourceFieldInfo = extractZodTypeInfo(sObj[renamedFrom]);
                        const targetFieldInfo = extractZodTypeInfo(tObj[targetKey]);

                        this.analyze(
                            castingDirection,
                            sourceFieldInfo.innerSchema,
                            targetFieldInfo.innerSchema,
                            [...path, targetKey],
                            errors,
                            depth + 1
                        );
                    }
                }
            }
            else if(castingDirection === this.CASTING_DIRECTIONS.DOWN)
            {
                for(const [sourceKey, sourceSchema] of Object.entries<z.ZodType>(sObj))
                {
                    const renamedFrom = sourceSchema.meta()?.renamedFrom;
                    if(typeof renamedFrom === 'string' && Object.hasOwn(tObj, renamedFrom))
                    {
                        renameFromTo.set(sourceKey, renamedFrom);
                        renameToFrom.set(renamedFrom, sourceKey);

                        const sourceFieldInfo = extractZodTypeInfo(sObj[sourceKey]);
                        const targetFieldInfo = extractZodTypeInfo(tObj[renamedFrom]);

                        this.analyze(
                            castingDirection,
                            sourceFieldInfo.innerSchema,
                            targetFieldInfo.innerSchema,
                            [...path, renamedFrom],
                            errors,
                            depth + 1
                        );
                    }
                }
            }

            const keys = new Set([...Object.keys(sObj), ...Object.keys(tObj)]);
            for(const key of keys)
            {
                const currentPath = [...path, key];

                const sourceFieldInfo = !renameFromTo.has(key) && sObj[key] ? extractZodTypeInfo(sObj[key]) : null;
                const targetFieldInfo = !renameToFrom.has(key) && tObj[key] ? extractZodTypeInfo(tObj[key]) : null;

                // added field in target
                if(!sourceFieldInfo && targetFieldInfo)
                {
                    // added required field without default
                    if(
                        castingDirection === this.CASTING_DIRECTIONS.UP
                        && !targetFieldInfo.isOptional
                        && !targetFieldInfo.hasDefault
                    )
                    {
                        this.#pushError(
                            errors,
                            currentPath,
                            this.CASTING_ERRORS.REQUIRED_FIELD_ADDED,
                            {isOptional: targetFieldInfo.isOptional, hasDefault: targetFieldInfo.hasDefault}
                        );
                    }
                    continue;
                }

                // removed field in target
                if(sourceFieldInfo && !targetFieldInfo)
                {
                    // removed required field without default
                    if(
                        castingDirection === this.CASTING_DIRECTIONS.DOWN
                        && !sourceFieldInfo.isOptional
                        && !sourceFieldInfo.hasDefault
                    )
                    {
                        this.#pushError(
                            errors,
                            currentPath,
                            this.CASTING_ERRORS.REQUIRED_FIELD_REMOVED,
                            {isOptional: sourceFieldInfo.isOptional, hasDefault: sourceFieldInfo.hasDefault}
                        );
                    }
                    continue;
                }

                // both exist
                if(sourceFieldInfo && targetFieldInfo)
                {
                    // changed optional field to required field without default
                    if(
                        castingDirection === this.CASTING_DIRECTIONS.UP
                        && sourceFieldInfo.isOptional
                        && (!targetFieldInfo.isOptional && !targetFieldInfo.hasDefault)
                    )
                    {
                        this.#pushError(
                            errors,
                            currentPath,
                            this.CASTING_ERRORS.FIELD_NOW_REQUIRED,
                            {sourceIsOptional: sourceFieldInfo.isOptional, targetIsOptional: targetFieldInfo.isOptional, targetHasDefault: targetFieldInfo.hasDefault}
                        );
                    }

                    // recurse
                    this.analyze(
                        castingDirection,
                        sourceFieldInfo.innerSchema,
                        targetFieldInfo.innerSchema,
                        currentPath,
                        errors,
                        depth + 1
                    );
                }
            }
            return errors;
        },
        array(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors, depth) {
            return this.analyze(
                castingDirection,
                (sourceSchemaInfo.innerSchema as z.ZodArray).unwrap() as z.ZodType,
                (targetSchemaInfo.innerSchema as z.ZodArray).unwrap() as z.ZodType,
                [...path, '[0]'],
                errors,
                depth + 1
            );
        },
        enum(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors) {
            const sVals = new Set((sourceSchemaInfo.innerSchema as z.ZodEnum).options);
            const tVals = new Set((targetSchemaInfo.innerSchema as z.ZodEnum).options);

            if(castingDirection === this.CASTING_DIRECTIONS.UP)
            {
                for(const v of sVals)
                    if(!tVals.has(v))
                    {
                        this.#pushError(
                            errors,
                            path,
                            this.CASTING_ERRORS.VARIANT_REMOVED,
                            {value: v}
                        );
                    }
            }
            else if(castingDirection === this.CASTING_DIRECTIONS.DOWN)
            {
                for(const v of tVals)
                    if(!sVals.has(v))
                    {
                        this.#pushError(
                            errors,
                            path,
                            this.CASTING_ERRORS.VARIANT_ADDED,
                            {value: v}
                        );
                    }
            }
            return errors;
        },
        string(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors) {
            const sSchema = sourceSchemaInfo.innerSchema as z.ZodString;
            const tSchema = targetSchemaInfo.innerSchema as z.ZodString;
            const sMin = typeof sSchema.minLength === 'number' ? sSchema.minLength : -Infinity;
            const sMax = typeof sSchema.maxLength === 'number' ? sSchema.maxLength : Infinity;
            const tMin = typeof tSchema.minLength === 'number' ? tSchema.minLength : -Infinity;
            const tMax = typeof tSchema.maxLength === 'number' ? tSchema.maxLength : Infinity;

            if(castingDirection === this.CASTING_DIRECTIONS.DOWN && tMin < sMin || tMax > sMax)
            {
                this.#pushError(
                    errors,
                    path,
                    this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                    {type: 'string', sourceMin: sMin, sourceMax: sMax, targetMin: tMin, targetMax: tMax}
                );
            }
            if(castingDirection === this.CASTING_DIRECTIONS.UP && tMin > sMin || tMax < sMax)
            {
                this.#pushError(
                    errors,
                    path,
                    this.CASTING_ERRORS.SCALAR_TYPE_NARROWED,
                    {type: 'string', sourceMin: sMin, sourceMax: sMax, targetMin: tMin, targetMax: tMax}
                );
            }

            // Currently we allow any change in format (email, uuid, etc).

            return errors;
        },
        number(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors) {
            const sSchema = sourceSchemaInfo.innerSchema as z.ZodNumber;
            const tSchema = targetSchemaInfo.innerSchema as z.ZodNumber;
            const sMin = typeof sSchema.minValue === 'number' ? sSchema.minValue : -Infinity;
            const sMax = typeof sSchema.maxValue === 'number' ? sSchema.maxValue : Infinity;
            const tMin = typeof tSchema.minValue === 'number' ? tSchema.minValue : -Infinity;
            const tMax = typeof tSchema.maxValue === 'number' ? tSchema.maxValue : Infinity;

            if(castingDirection === this.CASTING_DIRECTIONS.DOWN)
            {
                if(sSchema.format === 'safeint' && !tSchema.format)
                {
                    this.#pushError(
                        errors,
                        path,
                        this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                        {sourceFormat: sSchema.format, targetFormat: tSchema.format}
                    );
                }
                else if(tMin < sMin || tMax > sMax)
                {
                    this.#pushError(
                        errors,
                        path,
                        this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                        {type: 'number', sourceMin: sMin, sourceMax: sMax, targetMin: tMin, targetMax: tMax}
                    );
                }
            }

            if(castingDirection === this.CASTING_DIRECTIONS.UP)
            {
                if(!sSchema.format && tSchema.format === 'safeint')
                {
                    this.#pushError(
                        errors,
                        path,
                        this.CASTING_ERRORS.SCALAR_TYPE_NARROWED,
                        {sourceFormat: sSchema.format, targetFormat: tSchema.format}
                    );
                }
                else if(tMin > sMin || tMax < sMax)
                {
                    this.#pushError(
                        errors,
                        path,
                        this.CASTING_ERRORS.SCALAR_TYPE_NARROWED,
                        {type: 'number', sourceMin: sMin, sourceMax: sMax, targetMin: tMin, targetMax: tMax}
                    );
                }
            }
            return errors;
        },
        union(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors, depth) {
            const sourceOptions = (sourceSchemaInfo.innerSchema as z.ZodUnion).options;
            const targetOptions = (targetSchemaInfo.innerSchema as z.ZodUnion).options;

            if(castingDirection === this.CASTING_DIRECTIONS.UP)
            {
                sourceOptions.every(sourceOption => {
                    // if no target option is compatible with this source option
                    if(
                        !targetOptions.some(
                            tOption => !this.analyze(
                                castingDirection,
                                sourceOption as z.ZodType,
                                tOption as z.ZodType,
                                path,
                                [],
                                depth + 1
                            ).length
                        )
                    )
                        this.#pushError(
                            errors,
                            path,
                            this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                            {type: 'union', sourceOption, targetOptions}
                        );
                    return true;
                });
            }
            if(castingDirection === this.CASTING_DIRECTIONS.DOWN)
            {
                targetOptions.every(targetOption => {
                    // if no source option is compatible with this target option
                    if(
                        !sourceOptions.some(
                            sOption => !this.analyze(
                                castingDirection,
                                sOption as z.ZodType,
                                targetOption as z.ZodType,
                                path,
                                [],
                                depth + 1
                            ).length
                        )
                    )
                        this.#pushError(
                            errors,
                            path,
                            this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                            {type: 'union', sourceOptions, targetOption}
                        );
                    return true;
                });
            }

            return errors;
        },
        literal(castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors) {
            const sourceValue = (sourceSchemaInfo.innerSchema as z.ZodLiteral).value;
            const targetValue = (targetSchemaInfo.innerSchema as z.ZodLiteral).value;
            if(sourceValue !== targetValue)
            {
                this.#pushError(
                    errors,
                    path,
                    this.CASTING_ERRORS.SCALAR_TYPE_WIDENED,
                    {type: 'literal', sourceValue, targetValue}
                );
            }
            return errors;
        }
    };

    /**
     * Detects casting errors between source and target schemas.
     * @param castingDirection - The casting direction.
     * @param sourceSchema - The source Zod schema.
     * @param targetSchema - The target Zod schema.
     * @param path - Current path in the schema for error reporting.
     * @param errors - Array to collect errors.
     * @param depth - Recursion depth to prevent stack overflow.
     * @returns The errors array with any detected incompatibilities.
     */
    static analyze(
        castingDirection: CastingDirection,
        sourceSchema: z.ZodType,
        targetSchema: z.ZodType,
        path: string[] = [],
        errors: CastingError[] = [],
        depth: number = 0
    ): CastingError[] {
        if(depth > this.RECURSION_DEPTH)
            throw new Error(`Recursion depth exceeded while analyzing at path: ${path.join('.')}`);

        const sourceSchemaInfo = extractZodTypeInfo(sourceSchema);
        const targetSchemaInfo = extractZodTypeInfo(targetSchema);

        // if types are explicitly different -> incompatible (Change type)
        if(sourceSchemaInfo.type !== targetSchemaInfo.type)
        {
            this.#pushError(
                errors,
                path,
                this.CASTING_ERRORS.TYPE_MISMATCH,
                {sourceType: sourceSchemaInfo.type, targetType: targetSchemaInfo.type}
            );
            return errors;
        }

        const handler = this.#ANALYZERS[sourceSchemaInfo.type /* ?? targetSchemaInfo.type */];
        return handler
            ? handler.call(this, castingDirection, sourceSchemaInfo, targetSchemaInfo, path, errors, depth)
            : errors;
    }

    static isCastable(
        castingDirection: CastingDirection,
        sourceSchema: StandardSchemaV1,
        targetSchema: StandardSchemaV1
    ) {
        /*
          +––––––––––––––––––––––––––––––––––––+–––––––––––––––––+–––––––––––––––––+–––––––––––––––––+
          | Operation                          |    downcast     |      upcast     |      both       |
          |                                    |    (forward)    |    (backward)   |     (full)      |
          +––––––––––––––––––––––––––––––––––––+–––––––––––––––––+–––––––––––––––––+–––––––––––––––––+
          | Change type                        |        n        |        n        |        n        |
          | Add required field                 |        y        |        n        |        n        |
          | Remove required field              |        n        |        y        |        n        |
          | Add required field with default    |        y        | y (set default) |        y        |
          | Remove required field with default | y (set default) |        y        |        y        |
          | Add optional field                 |        y        |        y        |        y        |
          | Remove optional field              |        y        |        y        |        y        |
          | Add variant (oneof)                |        n        |        y        |        n        |
          | Remove variant (oneof)             |        y        |        n        |        n        |
          | Widen scalar type                  |        n        |        y        |        n        |
          | Narrow scalar type                 |        y        |        n        |        n        |
          | Rename object key                  |        y        |        y        |        y        |
          +––––––––––––––––––––––––––––––––––––+–––––––––––––––––+–––––––––––––––––+–––––––––––––––––+
        */
        if(
            !(sourceSchema instanceof z.ZodType)
            || !(targetSchema instanceof z.ZodType)
        )
        {
            console.info('Event casting is currently only supported for Zod schemas.');
            return false;
        }
        return !this.analyze(castingDirection, sourceSchema, targetSchema).length;
    }

    /**
     * Handlers for transforming payloads for different schema types.
     */
    static readonly #TRANSFORMERS: Record<string, (this: typeof EventCaster, castingDirection: CastingDirection, sourceSchemaInfo: TypeInfo, targetSchemaInfo: TypeInfo, payload: any, strict: boolean, depth: number) => any> = {
        object(castingDirection, sourceSchemaInfo, targetSchemaInfo, payload, strict, depth) {
            const sObj = (sourceSchemaInfo.innerSchema as z.ZodObject).shape;
            const tObj = (targetSchemaInfo.innerSchema as z.ZodObject).shape;

            // handle renames
            if(castingDirection === this.CASTING_DIRECTIONS.UP)
            {
                for(const [key, schema] of Object.entries(tObj))
                {
                    const renamedFrom = schema.meta()?.renamedFrom;
                    if(typeof renamedFrom === 'string' && Object.hasOwn(payload, renamedFrom))
                    {
                        payload[key] = payload[renamedFrom];
                        delete payload[renamedFrom];
                    }
                }
            }
            else if(castingDirection === this.CASTING_DIRECTIONS.DOWN)
            {
                for(const [key, schema] of Object.entries(sObj))
                {
                    const renamedFrom = schema.meta()?.renamedFrom;
                    if(typeof renamedFrom === 'string' && Object.hasOwn(payload, key))
                    {
                        payload[renamedFrom] = payload[key];
                        delete payload[key];
                    }
                }
            }

            // handle added fields with defaults
            for(const [key, schema] of Object.entries(tObj))
            {
                const fieldInfo = extractZodTypeInfo(schema);
                if(!Object.hasOwn(payload, key))
                {
                    if(fieldInfo.hasDefault)
                        payload[key] = fieldInfo.defaultValue;
                    else if(strict && !fieldInfo.isOptional)
                        throw new Error(`Missing required field: ${key}`);
                }
            }

            // handle removed fields
            for(const key of Object.keys(payload))
            {
                if(!Object.hasOwn(tObj, key))
                    delete payload[key];
            }

            // recurse on common fields
            for(const key of Object.keys(tObj))
            {
                if(Object.hasOwn(sObj, key) && Object.hasOwn(payload, key))
                {
                    const sourceFieldInfo = extractZodTypeInfo(sObj[key]);
                    const targetFieldInfo = extractZodTypeInfo(tObj[key]);
                    payload[key] = this.transform(
                        castingDirection,
                        sourceFieldInfo.innerSchema,
                        targetFieldInfo.innerSchema,
                        payload[key],
                        strict,
                        depth + 1
                    );
                }
            }

            return payload;
        },
        array(castingDirection, sourceSchemaInfo, targetSchemaInfo, payload, strict, depth) {
            if(!Array.isArray(payload))
            {
                if(strict)
                    throw new Error(`Expected array but got ${typeof payload}.`);
                return payload;
            }
            return payload.map(item =>
                this.transform(
                    castingDirection,
                    (sourceSchemaInfo.innerSchema as z.ZodArray).unwrap() as z.ZodType,
                    (targetSchemaInfo.innerSchema as z.ZodArray).unwrap() as z.ZodType,
                    item,
                    strict,
                    depth + 1
                )
            );
        }
    };

    /**
     * Transforms a payload to match the target schema.
     * Assumes schemas are compatible as per analyze.
     * @param castingDirection - The casting direction.
     * @param sourceSchema - The source Zod schema.
     * @param targetSchema - The target Zod schema.
     * @param payload - The payload to transform.
     * @param depth - Recursion depth to prevent stack overflow.
     * @returns The transformed payload.
     */
    static transform(
        castingDirection: (typeof this.CASTING_DIRECTIONS)[keyof typeof this.CASTING_DIRECTIONS],
        sourceSchema: z.ZodType,
        targetSchema: z.ZodType,
        payload: any,
        strict: boolean = false,
        depth: number = 0
    ) {
        if(depth > this.RECURSION_DEPTH)
            throw new Error(`Recursion depth exceeded while transforming at depth: ${depth}`);

        const sourceSchemaInfo = extractZodTypeInfo(sourceSchema);
        const targetSchemaInfo = extractZodTypeInfo(targetSchema);

        const handler = this.#TRANSFORMERS[targetSchemaInfo.type];
        return handler
            ? handler.call(this, castingDirection, sourceSchemaInfo, targetSchemaInfo, payload, strict, depth)
            : payload;
    }

    constructor(
        eventMap: EventMap,
        options: EventCasterOptions = {}
    ) {
        this.eventMap = eventMap;
        this.options = options;
    }

    async cast(
        event: Event,
        targetVersion: number,
        options: EventCasterOptions = {}
    ) {
        const strict = options.strict ?? this.options.strict ?? false;

        const eventType = event.type;
        const eventVersion = event.version;

        const eventData = event.toJSON();

        // no casting needed
        if(eventVersion === targetVersion)
            return Event.fromJSON(eventData);

        // eventMap is not up to date
        if(!this.eventMap[eventType]?.[eventVersion] || !this.eventMap[eventType]?.[targetVersion])
        {
            event = Event.fromJSON(eventData);
            const fallback = options.fallback ?? this.options.fallback;
            if(fallback)
                return fallback(event, targetVersion, strict);
            throw new Error(`Event casting from '${event.getDisplayName()}' to '${Event.getDisplayName(eventType, targetVersion)}' failed because eventMap is not up to date.`);
        }

        eventData.version = targetVersion;
        event = Event.fromJSON(eventData);

        const direction = targetVersion - eventVersion < 0 ? -1 : 1;
        const castingDirection = direction > 0 ? EventCaster.CASTING_DIRECTIONS.UP : EventCaster.CASTING_DIRECTIONS.DOWN;
        for(let v = eventVersion + direction; v !== targetVersion + direction; v += direction)
        {
            const sourceEventClass = this.eventMap[eventType][v - direction];
            const targetEventClass = this.eventMap[eventType][v];
            event.payload = EventCaster.transform(
                castingDirection,
                sourceEventClass.schema as z.ZodType,
                targetEventClass.schema as z.ZodType,
                event.payload,
                strict
            );
        }

        return event;
    }
}
