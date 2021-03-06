const {Universal, Node, MemoryAccount, Crypto} = require('@aeternity/aepp-sdk');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const BigNumber = require("bignumber.js");

const url = 'https://testnet.aeternity.io/';

module.exports = class Aeternity {

  stopAwaitFunding = false;

  init = async (keyPair) => {
    if (!this.client) {
      this.keypair = this.getKeyPair(keyPair);
      this.client = await Universal({
        nodes: [
          {
            name: 'node',
            instance: await Node({
              url: process.env.NODE_URL || url,
              internalUrl: process.env.NODE_URL || url,
            }),
          }],
        accounts: [MemoryAccount({keypair: this.keypair})],
      });
    }
  };

  getKeyPair = (defaultKeyPair) => {
    if (defaultKeyPair) return defaultKeyPair;

    const keypairFile = path.resolve(__dirname, "../.data/keypair.json");
    const persisted = fs.existsSync(keypairFile);
    if (persisted) {
      return JSON.parse(fs.readFileSync(keypairFile), "utf-8");
    } else {
      const keypair = Crypto.generateKeyPair();
      fs.writeFileSync(keypairFile, JSON.stringify(keypair), "utf-8");
      return keypair;
    }
  };

  stopAwaitFundingCheck = () => {
    this.stopAwaitFunding = true;
  }

  atomsToAe = (atoms) => (new BigNumber(atoms)).dividedBy(new BigNumber(1000000000000000000));

  awaitFunding = async (fundingAmount) => {
    if (!this.client) throw "Client not initialized";

    if (new BigNumber(await this.client.getBalance(this.keypair.publicKey)).isLessThan(new BigNumber(fundingAmount).dividedBy(2))) {
      qrcode.generate(this.keypair.publicKey, {small: true});
      console.log("Fund Oracle Service Wallet", this.keypair.publicKey, this.atomsToAe(fundingAmount).toFixed(), "AE");
      await new Promise(resolve => {
        const interval = setInterval(async () => {
          if (new BigNumber(await this.client.getBalance(this.keypair.publicKey)).isGreaterThanOrEqualTo(fundingAmount)) {
            console.log("received funding");
            resolve(true);
            this.awaitFunding(fundingAmount)
            clearInterval(interval);
          }
        }, 2000);
      });
    } else {
      if (!this.stopAwaitFunding) setTimeout(() => {
        this.awaitFunding(fundingAmount)
      }, 20000);
    }
  };

};
