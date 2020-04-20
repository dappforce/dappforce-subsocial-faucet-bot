const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config()

const Actions = require('./actions.js');

const Storage = require('./storage.js');
const storage = new Storage();

const app = express();
app.use(bodyParser.json());
const port = 5555;

const mnemonic = process.env.MNEMONIC;
const privilegedSenders = (process.env.PRIVILEGED_SENDERS).split(",");

app.get('/health', (_, res) => {
  res.send('Faucet backend is healthy.');
});

const createAndApplyActions = async () => {
  const actions = new Actions();
  await actions.create(mnemonic);

  app.get('/balance', async (_, res) => {
    const balance = await actions.checkBalance();
    res.send(balance.toString());
  });
  
  app.post('/bot-endpoint', async (req, res) => {
    const { address, amount, sender } = req.body;

    if (!(await storage.isValid(sender, address)) && !privilegedSenders.includes(sender)) {
      res.send('LIMIT');
    }

    await storage.saveData(sender, address);
    
    const hash = await actions.sendTokens(address, amount);
    res.send(hash);
  });
  
  
  app.post('/web-endpoint', (req, res) => {
  
  });
}

const main = async () => {
  await createAndApplyActions();

  app.listen(port, () => console.log(`Faucet backend listening on port ${port}.`));
}

try {
  main();
} catch (e) { console.error(e); }

