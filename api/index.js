const { ApiPromise, WsProvider } = require('@polkadot/api');

module.exports = async (req, res) => {
  try {
    const wsProvider = new WsProvider('wss://rpc-mainnet.vtrs.io:443');
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("Connected to Substrate!");

    // Define the asset ID (u128)
    const assetId = 1;

    console.log("Fetching accounts for asset ID:", assetId);

    // Fetch all keys for the asset
    const keys = await api.query.assets.account.keys();
    const accountIds = keys.map((key) => key.args[0].toHuman());
    const accounts = await Promise.all(
      keys.map(async (key) => {
        const accountId = key.args[1].toHuman(); 
        const accountInfo = await api.query.assets.account(assetId, accountId);

        if (accountInfo.isSome) {
          const accountDetails = accountInfo.unwrap();

          return {
            assetId,
            accountId,
            balance: accountDetails.balance.toString(),
            status: accountDetails.status.toHuman(),
          };
        } else {
          return {
            assetId,
            accountId,
            balance: "0",
            status: "None",
          };
        }
      })
    );

    res.status(200).json({ accounts });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
