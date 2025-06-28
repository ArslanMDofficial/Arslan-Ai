require('./settings');
const fs = require('fs');
const chalk = require('chalk');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidDecode, jidNormalizedUser, delay } = require('@whiskeysockets/baileys');
const NodeCache = require('node-cache');
const readline = require('readline');
const PhoneNumber = require('awesome-phonenumber');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const { smsg } = require('./lib/myfunc');

// Ultra Pro Max Configurations
const phoneNumber = "923237045919";

// Place-holder owner, will be updated after connection
global.owner = [];
global.botname = "Arslan-MD";
global.themeemoji = "✨";
global.reactEmoji = "❤️"; // Single reaction emoji
global.autoReactEnabled = false; // Default: Auto-reaction OFF
global.premiumFeatures = true;
global.autoReadMessages = true;

// Enhanced Settings
const settings = require('./settings');
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings.ownerNumber || phoneNumber);

async function startBot() {
    let { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const msgRetryCounterCache = new NodeCache();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => "",
        msgRetryCounterCache
    });

    // Ultra Pro Max Message Handler
    sock.ev.on('messages.upsert', async chatUpdate => {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

        if (!sock.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;

        try {
            // Single Reaction Feature
            if (!mek.key.fromMe && global.reactEmoji) {
                await sock.sendMessage(mek.key.remoteJid, {
                    react: {
                        text: global.reactEmoji,
                        key: mek.key
                    }
                });
            }

            await handleMessages(sock, chatUpdate, true);
        } catch (err) {
            console.log(chalk.red("❌ Error in handleMessages:", err));
        }
    });

    // Enhanced Connection Handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        console.log(chalk.blue('Connection update:', connection));

        if (lastDisconnect) {
            console.log(chalk.yellow('Last disconnect reason:', lastDisconnect.error?.output?.statusCode, lastDisconnect.error?.message));
        }

        if (connection === 'open') {
            // ✅ Automatically set owner from connected number
            global.owner = [sock.user.id.split(':')[0]];
            console.log(chalk.green(`🤖 ${global.botname} Connected Successfully as ${sock.user.id}`));

            // Premium Startup Message
            setTimeout(async () => {
                try {
                    await sock.sendMessage(sock.user.id, {
                        text: `🌟 *${global.botname} Activated!*\n\n` +
                              `🕒 Time: ${new Date().toLocaleString()}\n` +
                              `📢 Official Channel: https://whatsapp.com/channel/0029VarfjW04tRrmwfb8x306\n` +
                              `💎 Version: ULTRA PRO MAX`
                    });
                    console.log(chalk.cyan("✅ Premium startup message sent successfully."));
                } catch (error) {
                    console.log(chalk.red("❌ Socket not ready. Skipping startup message."));
                }
            }, 5000);
        }

        if (connection === "close") {
            console.log(chalk.yellow("🔄 Reconnecting..."));
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                console.log(chalk.red("🔴 Logged out from WhatsApp, please reauthenticate!"));
            }
        }
    });

    // Other Event Handlers
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('group-participants.update', async update => {
        await handleGroupParticipantUpdate(sock, update);
    });

    sock.ev.on('status.update', async (status) => {
        await handleStatus(sock, status);
    });

    // Premium Features
    sock.public = true;
    sock.serializeM = (m) => smsg(sock, m);

    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    sock.getName = (jid, withoutContact = false) => {
        jid = sock.decodeJid(jid);
        let v = jid === '0@s.whatsapp.net' ? {
            id: jid,
            name: 'WhatsApp'
        } : (jid === sock.decodeJid(sock.user.id) ? sock.user : {});
        return (withoutContact ? '' : v.name) || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
    };

    // Ultra Pro Max Auto-Reconnect
    setInterval(() => {
        if (!sock.user) {
            console.log(chalk.yellow("🔄 Attempting auto-reconnect..."));
            startBot().catch(err => console.error(chalk.red("❌ Reconnect failed:", err)));
        }
    }, 300000); // 5 minutes
}

// Start the Ultra Pro Max Bot
startBot().catch(err => {
    console.error(chalk.red("❌ Fatal Error:", err));
});

// Error Handling
process.on('uncaughtException', err => console.error(chalk.red('❗ Uncaught Exception:', err)));
process.on('unhandledRejection', err => console.error(chalk.red('❗ Unhandled Rejection:', err)));
                       
