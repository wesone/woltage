import type {CommandContext, Plugin} from 'woltage';

type CustomContext = CommandContext<{
    userId?: string;
    roles: string[];
}>;

export const plugins: Plugin[] = [
    {
        handle: 'woltage-authorization-plugin',
        name: 'authorization',
        hooks: {
            async beforeCommandExecution({commandInfo, context}) {
                if(
                    commandInfo.aggregate.type === 'user'
                    && commandInfo.name === 'register'
                    && !(context as CustomContext).roles.includes('admin')
                )
                {
                    return {
                        error: new Error('Only admin users can register users.')
                    };
                }
            }
        }
    },
    {
        handle: 'woltage-audit-logger-plugin',
        name: 'audit-logger',
        errorStrategy: 'log',
        hooks: {
            async afterCommandExecution({commandInfo, stateUpdate, context}) {
                const ctx = context as CustomContext;
                console.log('[AUDIT] Command executed:', {
                    commandName: commandInfo.name,
                    aggregateType: commandInfo.aggregate.type,
                    aggregateId: ctx.aggregateId,
                    aggregateVersion: ctx.aggregateVersion,
                    executedByUserId: ctx.userId ?? 'unknown',
                    stateUpdate
                });
            },
            async onCommandExecutionError({commandInfo, error, context}) {
                const ctx = context as CustomContext;
                console.error('[AUDIT] Command failed:', {
                    commandName: commandInfo.name,
                    aggregateType: commandInfo.aggregate.type,
                    aggregateId: ctx.aggregateId,
                    aggregateVersion: ctx.aggregateVersion,
                    executedByUserId: ctx.userId ?? 'unknown',
                    message: error.message
                });
            }
        }
    }
];
