import type {Woltage} from 'woltage';
import open from './aggregates/account/open.ts';
import credit from './aggregates/account/credit.ts';
import debit from './aggregates/account/debit.ts';

export default async (woltage: Woltage) => {
    // Create a long history of transactions for the same account to demonstrate snapshotting
    const accountId = 'account-1';
    await woltage.executeCommand(open, accountId, {initialBalance: 0});
    await woltage.executeCommand(credit, accountId, {amount: 10});
    await woltage.executeCommand(credit, accountId, {amount: 5});
    await woltage.executeCommand(credit, accountId, {amount: 5});
    await woltage.executeCommand(debit, accountId, {amount: 10});
    await woltage.executeCommand(credit, accountId, {amount: 500});
    await woltage.executeCommand(debit, accountId, {amount: 100});
    await woltage.executeCommand(credit, accountId, {amount: 10});
    await woltage.executeCommand(debit, accountId, {amount: 420});
    await woltage.executeCommand(credit, accountId, {amount: 10});
    await woltage.executeCommand(credit, accountId, {amount: 5});
    await woltage.executeCommand(credit, accountId, {amount: 5});
    await woltage.executeCommand(debit, accountId, {amount: 10});
    await woltage.executeCommand(credit, accountId, {amount: 500});
    await woltage.executeCommand(debit, accountId, {amount: 100});
    await woltage.executeCommand(credit, accountId, {amount: 10});
    await woltage.executeCommand(debit, accountId, {amount: 420});
    console.log('Transactions created...');
};
