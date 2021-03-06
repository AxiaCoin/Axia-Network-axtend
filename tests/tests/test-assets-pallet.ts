import Keyring from "@axiaaxc/keyring";
import { expect } from "chai";
import { BN } from "@axiaaxc/util";
import { ALITH, ALITH_PRIV_KEY, BALTATHAR } from "../util/constants";

import { describeDevMoonbeam } from "../util/setup-dev-tests";
import { createBlockWithExtrinsic } from "../util/axlib-rpc";
import { mockAssetBalance } from "./test-precompile/test-precompile-assets-erc20";

const TEST_ACCOUNT = "0x1111111111111111111111111111111111111111";

describeDevMoonbeam("Pallet Assets Pallet - assets transfer", (context) => {
  let sudoAccount, assetId;
  before("Try turning maintenance mode on", async () => {
    const keyring = new Keyring({ type: "ethereum" });
    sudoAccount = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");

    // We need to mint units with sudo.setStorage, as we dont have xcm mocker yet
    // And we need relay tokens for issuing a transaction to be executed in the relay
    const balance = context.axiaaxcApi.createType("Balance", 100000000000000);
    const assetBalance = context.axiaaxcApi.createType("PalletAssetsAssetBalance", {
      balance: balance,
    });

    assetId = context.axiaaxcApi.createType(
      "u128",
      new BN("42259045809535163221576417993425387648")
    );
    const assetDetails = context.axiaaxcApi.createType("PalletAssetsAssetDetails", {
      supply: balance,
    });

    await mockAssetBalance(context, assetBalance, assetDetails, sudoAccount, assetId, ALITH);

    await createBlockWithExtrinsic(
      context,
      sudoAccount,
      context.axiaaxcApi.tx.assets.transfer(assetId, BALTATHAR, 1000)
    );
  });

  it("should transfer asset", async function () {
    // Baltathar balance is 1000
    let baltatharBalance = (await context.axiaaxcApi.query.assets.account(
      assetId,
      BALTATHAR
    )) as any;
    expect(baltatharBalance.balance.eq(new BN(1000))).to.equal(true);
  });
});
