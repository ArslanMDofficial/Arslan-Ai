const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');

// 🔥 CONFIG
const CONFIG_PATH = path.join(__dirname, '../data/autoreact.json');
const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'smart', // smart | random | fixed
    emoji: '❤️',
    whitelist: [],
    blacklist: []
};

const EMOJI_SETS = {
    standard: ['✨', '⚡', '🔥', '💥', '🌟', '🎯', '🚀', '🎉', '💫'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍'],
    stars: ['⭐', '🌟', '🌠', '💫', '✨', '☄️', '🌌', '🔭', '🪐']
};

// 🔁 Load config
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
    try {
        const data = JSON.parse(fs.readFileSync(CONFIG_PATH));
        return { ...DEFAULT_CONFIG, ...data };
    } catch (err) {
        console.error('[AutoReact] Config load failed:', err);
        return DEFAULT_CONFIG;
    }
}

class ReactionMaster {
    constructor() {
        this.currentSet = EMOJI_SETS.standard;
    }

    getSmartEmoji(message) {
        const msgText = message.message?.conversation || '';
        if (msgText.includes('?')) return '🤔';
        if (msgText.includes('!')) return '❗';
        if (msgText.length > 50) return '📝';
        return this.currentSet[Math.floor(Math.random() * this.currentSet.length)];
    }

    getReactionEmoji(message, config) {
        switch (config.mode) {
            case 'fixed':
                return config.emoji;
            case 'smart':
                return this.getSmartEmoji(message);
            case 'random':
            default:
                return this.currentSet[Math.floor(Math.random() * this.currentSet.length)];
        }
    }

    async saveConfig(config) {
        try {
            await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        } catch (err) {
            console.error('[AutoReact] Config save failed:', err);
            throw new Boom('Failed to save config', { statusCode: 500 });
        }
    }

    async addReaction(sock, message) {
        const config = loadConfig();
        if (!config.enabled || !message?.key) return false;

        const sender = message.key.remoteJid;
        if (config.blacklist.includes(sender)) return false;
        if (config.whitelist.length > 0 && !config.whitelist.includes(sender)) return false;

        try {
            const emoji = this.getReactionEmoji(message, config);
            await sock.sendMessage(sender, {
                react: { text: emoji, key: message.key }
            });
            return true;
        } catch (err) {
            console.error('[AutoReact] Failed to send reaction:', err);
            return false;
        }
    }

    async handleCommand(sock, chatId, msg, isOwner) {
        const config = loadConfig();
        const text = msg.message?.conversation || '';
        const args = text.trim().split(' ');

        if (!isOwner) {
            return await sock.sendMessage(chatId, {
                text: '🚫 *Owner Only Command*',
                quoted: msg
            });
        }

        try {
            switch ((args[1] || '').toLowerCase()) {
                case 'on':
                    config.enabled = true;
                    await this.saveConfig(config);
                    return await sock.sendMessage(chatId, {
                        text: '✅ *Auto-Reaction Enabled!*',
                        quoted: msg
                    });

                case 'off':
                    config.enabled = false;
                    await this.saveConfig(config);
                    return await sock.sendMessage(chatId, {
                        text: '❌ *Auto-Reaction Disabled!*',
                        quoted: msg
                    });

                case 'mode':
                    if (['smart', 'random', 'fixed'].includes(args[2])) {
                        config.mode = args[2];
                        await this.saveConfig(config);
                        return await sock.sendMessage(chatId, {
                            text: `🔁 *Mode changed to:* ${args[2].toUpperCase()}`,
                            quoted: msg
                        });
                    }
                    break;

                case 'set':
                    if (args[2] && EMOJI_SETS[args[2]]) {
                        this.currentSet = EMOJI_SETS[args[2]];
                        config.mode = 'random';
                        await this.saveConfig(config);
                        return await sock.sendMessage(chatId, {
                            text: `🎨 *Emoji Set changed to:* ${args[2].toUpperCase()}`,
                            quoted: msg
                        });
                    } else if (args[2]) {
                        config.emoji = args[2];
                        config.mode = 'fixed';
                        await this.saveConfig(config);
                        return await sock.sendMessage(chatId, {
                            text: `🧷 *Fixed Emoji set to:* ${args[2]}`,
                            quoted: msg
                        });
                    }
                    break;

                default:
                    return await sock.sendMessage(chatId, {
                        text: `📖 *AutoReaction Settings:*
Status: ${config.enabled ? '🟢 ON' : '🔴 OFF'}
Mode: ${config.mode.toUpperCase()}
Emoji: ${config.emoji}

📌 Commands:
.autoreact on/off
.autoreact mode [smart|random|fixed]
.autoreact set [❤️ | standard | hearts | stars]`,
                        quoted: msg
                    });
            }
        } catch (err) {
            console.error('[AutoReact] Command error:', err);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to process .autoreact command!',
                quoted: msg
            });
        }
    }
}

// 🔁 EXPORT
const reactionMaster = new ReactionMaster();
module.exports = {
    addReaction: (sock, msg) => reactionMaster.addReaction(sock, msg),
    handleCommand: (sock, chatId, msg, isOwner) => reactionMaster.handleCommand(sock, chatId, msg, isOwner)
};
