const { ApiPromise, WsProvider } = require('@polkadot/api');

module.exports = async (req, res) => {
  try {
    const wsProvider = new WsProvider('wss://rpc-mainnet.vtrs.io:443');
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("Connected to Substrate!");

    // Define the asset IDs to query
    const assetIds = [0, 1, 2];
    console.log("Fetching accounts for asset IDs:", assetIds);

    const accountsData = [];

    for (const assetId of assetIds) {
      console.log(`Fetching accounts for asset ID: ${assetId}`);

      // Fetch keys specific to the assetId
      const keys = await api.query.assets.account.keys(assetId);
      const assetAccounts = await Promise.all(
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

      accountsData.push(...assetAccounts);
    }

    res.status(200).json({ accounts: accountsData });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
