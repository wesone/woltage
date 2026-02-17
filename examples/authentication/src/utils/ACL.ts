
import jwt from 'jsonwebtoken';
import type {RequestHandler} from 'express';
import apiStorage from '../api/apiStorage.ts';
import {ForbiddenError, UnauthorizedError} from 'woltage';

/**
 * This acl system is meant for demonstation purposes only.
 * It is very basic with bad performance and limited functionality.
 */

const AUTH_TOKEN_TTL_SECONDS = 60 * 30;
export const AUTH_TOKEN_HEADER_NAME = 'x-token';
const PUBLIC = '_public';
export const ROLES = Object.freeze({
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
});
const PERMISSIONS = Object.freeze({
    [PUBLIC]: ['/register', '/login'],
    [ROLES.USER]: [],
    [ROLES.MODERATOR]: ['/projection/add', '/projection/list', '/projection/switch', '/projection/remove'],
    [ROLES.ADMIN]: ['/user/:aggregateId/addRole', '/user/:aggregateId/removeRole']
});

export const generateToken = (payload: any) => jwt.sign(payload, process.env.JWT_PRIVATE_KEY!, {expiresIn: AUTH_TOKEN_TTL_SECONDS});

export const verifyToken = (token: string) => jwt.verify(token, process.env.JWT_PRIVATE_KEY!);

export type Role = typeof ROLES[keyof typeof ROLES];

export const AVAILABLE_ROLES = Object.values(ROLES);

const matchRoute = (requestedRoute: string, allowedRoutes: string[]) => allowedRoutes.some(allowedRoute => {
    if(allowedRoute.includes('/:'))
        return new RegExp(`^${allowedRoute.replace(/\/:[^/]+/g, '/[^/]+')}$`).test(requestedRoute);
    return requestedRoute === allowedRoute;
});

export const aclMiddlewares: RequestHandler[] = [
    // auth middleware
    (req, res, next) => {
        const token = req.get(AUTH_TOKEN_HEADER_NAME);
        req.user = token
            ? verifyToken(token) as NonNullable<typeof req['user']>
            : null;

        apiStorage.run({
            user: req.user
        }, next);
    },
    // access control middleware
    (req, res, next) => {
        if(matchRoute(req.path, PERMISSIONS[PUBLIC]))
            return next();
        if(req.user === null)
            throw new UnauthorizedError();
        console.log(req.user.roles);
        if(req.user.roles.some(role => matchRoute(req.path, PERMISSIONS[role])))
            return next();
        throw new ForbiddenError();
    }
];
