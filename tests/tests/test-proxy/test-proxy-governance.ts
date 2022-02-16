import { expect } from "chai";
import Keyring from "@axiaaxc/keyring";
import {
  ALITH_PRIV_KEY,
  DOROTHY,
  DOROTHY_PRIV_KEY,
  ETHAN,
  ETHAN_PRIVKEY,
  GLMR,
  VOTE_AMOUNT,
} from "../../util/constants";
import { describeDevMoonbeam } from "../../util/setup-dev-tests";
import {
  execFromTwoThirdsOfCouncil,
  execFromAllMembersOfTechCommittee,
} from "../../util/governance";
import { createBlockWithExtrinsic } from "../../util/axlib-rpc";

const keyring = new Keyring({ type: "ethereum" });
const proposalHash = "0xf3d039875302d49d52fb1af6877a2c46bc55b004afb8130f94dd9d0489ca3185";

let alith;
let dorothy;
let ethan;

describeDevMoonbeam("Proxing governance", (context) => {
  before("Create accounts and fast-tracking referundum", async () => {
    alith = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
    dorothy = await keyring.addFromUri(DOROTHY_PRIV_KEY, null, "ethereum");
    ethan = await keyring.addFromUri(ETHAN_PRIVKEY, null, "ethereum");

    await execFromTwoThirdsOfCouncil(
      context,
      context.axiaaxcApi.tx.democracy.externalProposeMajority(proposalHash)
    );
    await execFromAllMembersOfTechCommittee(
      context,
      context.axiaaxcApi.tx.democracy.fastTrack(proposalHash, 5, 0)
    );
  });

  it("should be able to vote on behalf of the delegate account", async function () {
    // Verify that one referundum is triggered
    let referendumCount = await context.axiaaxcApi.query.democracy.referendumCount();
    expect(referendumCount.toBigInt()).to.equal(1n);

    // Dorothy add proxy right to ethan for governance only
    await context.axiaaxcApi.tx.proxy.addProxy(ETHAN, "Governance", 0).signAndSend(dorothy);
    await context.createBlock();

    // Ethan vote as Dorothy
    const voteCall = context.axiaaxcApi.tx.democracy.vote(0, {
      Standard: { balance: VOTE_AMOUNT, vote: { aye: true, conviction: 1 } },
    });

    const dorothyPreBalance = (
      await context.axiaaxcApi.query.system.account(DOROTHY)
    ).data.free.toBigInt();
    const ext = context.axiaaxcApi.tx.proxy.proxy(DOROTHY, "Governance", voteCall);
    const { events } = await createBlockWithExtrinsic(context, ethan, ext);

    // Check events
    expect(context.axiaaxcApi.events.proxy.ProxyExecuted.is(events[2])).to.be.true;
    expect(context.axiaaxcApi.events.democracy.Voted.is(events[1])).to.be.true;
    expect(events[2].data[0].toString()).to.equal("Ok");
    expect(context.axiaaxcApi.events.treasury.Deposit.is(events[4])).to.be.true;
    expect(context.axiaaxcApi.events.system.ExtrinsicSuccess.is(events[5])).to.be.true;

    // Verify that dorothy hasn't paid for the transaction but the vote locked her tokens
    let dorothyAccountData = await context.axiaaxcApi.query.system.account(DOROTHY);
    expect(dorothyAccountData.data.free.toBigInt()).to.equal(dorothyPreBalance);
    expect(dorothyAccountData.data.miscFrozen.toBigInt()).to.equal(VOTE_AMOUNT);

    // Verify that vote is registered
    const referendumInfoOf = (
      await context.axiaaxcApi.query.democracy.referendumInfoOf(0)
    ).unwrap() as any;
    const onGoing = referendumInfoOf.asOngoing;

    expect(onGoing.proposalHash.toHex()).to.equal(proposalHash);
    expect(onGoing.tally.ayes.toBigInt()).to.equal(10n * GLMR);
    expect(onGoing.tally.turnout.toBigInt()).to.equal(10n * GLMR);
  });
});
