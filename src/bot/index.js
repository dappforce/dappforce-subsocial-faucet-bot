const mSDK = require('matrix-js-sdk');
const axios = require('axios');
const pdKeyring = require('@polkadot/keyring');
require('dotenv').config();

const botUserId = process.env.MATRIX_USER_ID;
const privilegedSenders = process.env.PRIVILEGED_SENDERS.split(',');
const tokenName = process.env.TOKEN_NAME;
const tokenDecimals = process.env.TOKEN_DECIMALS;

const bot = mSDK.createClient({
  baseUrl: 'https://matrix.org',
  accessToken: process.env.MATRIX_ACCESS_TOKEN,
  userId: botUserId,
  localTimeoutMs: 10000,
});

let ax = axios.create({
  baseURL: process.env.BACKEND_URL,
  timeout: 10000,
});

const sendMessage = (roomId, msg) => {
  bot.sendEvent(
    roomId,
    'm.room.message',
    { body: msg, msgtype: 'm.text' },
    '',
    console.error
  );
};

bot.on('RoomMember.membership', (_, member) => {
  if (member.membership === 'invite' && member.userId === botUserId) {
    bot.joinRoom(member.roomId).done(() => {
      console.log(`Auto-joined ${member.roomId}.`);
    });
  }
});

bot.on('Room.timeline', async (event) => {
  if (event.getType() !== 'm.room.message') {
    return; // Only act on messages (for now).
  }

  const {
    content: { body },
    event_id: eventId,
    room_id: roomId,
    sender,
  } = event.event;

  let [action, arg0, arg1] = body.split(' ');

  if (action === '!balance') {
    const res = await ax.get('/balance');
    const balance = res.data;

    bot.sendHtmlMessage(
      roomId,
      `The faucet has ${balance / 10 ** tokenDecimals} ${tokenName}s remaining.`
    );
  }

  if (action === '!drip') {
    try {
      pdKeyring.decodeAddress(arg0);
    } catch (e) {
      sendMessage(roomId, `${sender} provided an incompatible address.`);
      return;
    }

    let amount = process.env.DRIP_AMOUNT;
    if (privilegedSenders.includes(sender) && arg1) {
      amount = arg1;
    }

    const res = await ax.post('/bot-endpoint', {
      sender,
      address: arg0,
      amount,
    });

    if (res.data === 'LIMIT') {
      sendMessage(
        roomId,
        `${sender} has reached their daily quota. Only request twice per 24 hours.`
      );
      return;
    }

    bot.sendHtmlMessage(
      roomId,
      `Sent ${sender} ${amount} ${tokenName}s. Extrinsic hash: \`${res.data}.\``
      // `Sent ${sender} ${amount} ${tokenName}s. <a href="http://167.172.104.62/bc/#/explorer/query/${res.data}">View on a Blockchain Explorer.</a>`
    );
  }

  if (action === '!faucet') {
    sendMessage(
      roomId,
      `
Usage:
  !balance - Get the faucet's balance.
  !drip <Address> - Send Subsocial ${tokenName}s to <Address>.
  !faucet - Prints usage information.`
    );
  }
});

bot.startClient(0);
