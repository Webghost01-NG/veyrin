export const keystoneExpectedPczt = "UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRQBAAAAAAAAAAAAAAAAAAAAAAAAAIisAAABI3QxSHh0Z1hZVFBXMko4QmU5MUhYUzc3TUZneDU3cWtIcnZLAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA";

export const recipientMutationPczt = "UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGf3qhTxd6fgBYxmxyQuCGSIvT0QAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRRn96oU8Xen4AWMZsckLghkiL09EIisAAABI3QxVE1MSjdrMk40TmFycWs1RmQ1dVVvODJOWFNNYktSZ0NjAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA";

// Reproducibly derived from the Keystone fixture by replacing the three-byte
// CompactSize value at byte offset 193: 100,000 (a0 8d 06) -> 90,000 (90 bf 05).
// The deployed Zallet inspector independently decodes the result as a 10,000
// zatoshi fee and a 90,000 zatoshi transparent output.
export const feeEscalationPczt = "UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAZC/BRl2qRQBAAAAAAAAAAAAAAAAAAAAAAAAAIisAAABI3QxSHh0Z1hZVFBXMko4QmU5MUhYUzc3TUZneDU3cWtIcnZLAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA";

export const pcztFixtureProvenance = "https://github.com/KeystoneHQ/keystone-sdk-base/blob/master/packages/ur-registry-zcash/__tests__/ZcashPCZT.test.ts";

export interface PcztAttackScenario {
  id: "recipient-swap" | "fee-escalation";
  name: string;
  threat: string;
  expectedOutcome: string;
  returnedPczt: string;
  expectedChangedPaths: string[];
}

export const pcztAttackScenarios: PcztAttackScenario[] = [
  {
    id: "recipient-swap",
    name: "Recipient swap",
    threat: "A returned envelope redirects its transparent output.",
    expectedOutcome: "2 recipient fields",
    returnedPczt: recipientMutationPczt,
    expectedChangedPaths: [
      "transparent / outputs / 0 / address",
      "transparent / outputs / 0 / user_address"
    ]
  },
  {
    id: "fee-escalation",
    name: "Fee escalation",
    threat: "The transparent output drops by 10,000 zatoshis.",
    expectedOutcome: "fee + output value",
    returnedPczt: feeEscalationPczt,
    expectedChangedPaths: [
      "fee_zat",
      "transparent / outputs / 0 / value_zat"
    ]
  }
];
