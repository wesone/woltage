import type {IRoute, IRouterHandler} from 'express';

type FilterKeysByValue<T, ValueType> = {
    [K in keyof T]: T[K] extends ValueType ? K : never;
}[keyof T];

export type HTTPMethod = FilterKeysByValue<IRoute, IRouterHandler<IRoute>>;
