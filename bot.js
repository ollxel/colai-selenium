// --- ЗАВИСИМОСТИ ---
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Builder, By, Key, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

// --- КОНФИГУРАЦИЯ ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) throw new Error("КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не указан!");

console.log(`Бот запущен.`);

// --- КОНСТАНТЫ ---
// Константы, связанные с OpenRouter, удалены.
// Выбор моделей больше недоступен, так как мы взаимодействуем с конкретным сайтом.
const VOTE_KEYWORDS = { 'Russian': { accept: 'принимаю', reject: 'отклоняю' } };

// =========================================================================
// === NETWORK MANAGER, использующий Selenium для chat-ai.one ===
// =========================================================================
class NetworkManager {
    constructor() {
        // Определения сетей остаются для структуры совместной работы.
        this.networks = {
            network1: { name: 'Аналитическая Сеть' },
            network2: { name: 'Креативная Сеть' },
            network3: { name: 'Сеть Реализации' },
            network4: { name: 'Сеть Data Science' },
            network5: { name: 'Этическая Сеть' },
            network6: { name: 'Сеть UX' },
            network7: { name: 'Сеть Системного Мышления' },
            network8: { name: 'Сеть "Адвокат Дьявола"' },
            summarizer: { name: 'Сеть-Синтезатор' }
        };
    }

    /**
     * Настраивает и возвращает экземпляр драйвера Selenium Firefox.
     * @returns {import('selenium-webdriver').WebDriver}
     */
    async setupDriver() {
        // Настройка опций Firefox.
        // .headless() критически важен для запуска на сервере без графического интерфейса.
        const options = new firefox.Options()
            .headless()
            .addArguments("-private"); // Запуск в приватном режиме по запросу.

        // Сборка драйвера. Предполагается, что geckodriver находится в системном PATH.
        const driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();
        return driver;
    }

    /**
     * Генерирует ответ, взаимодействуя с chat-ai.one через Selenium.
     * @param {string} networkId - ID сети, генерирующей ответ.
     * @param {string} prompt - Пользовательский промпт для отправки.
     * @param {object} settings - Текущие настройки сессии.
     * @param {function} sendMessageCallback - Колбэк для отправки статусных сообщений.
     * @returns {Promise<string>} - Сгенерированный текст ответа.
     */
    async generateResponse(networkId, prompt, settings, sendMessageCallback) {
        const network = this.networks[networkId] || settings.custom_networks[networkId];
        if (!network) throw new Error(`Сеть ${networkId} не найдена.`);

        // Системный промпт теперь является частью основного промпта.
        const systemPrompt = ((settings.custom_networks[networkId]?.system_prompt) || settings.system_prompts[networkId]) +
            `\n\nВАЖНАЯ ИНСТРУКЦИЯ: Вы ДОЛЖНЫ отвечать ИСКЛЮЧИТЕЛЬНО на ${settings.discussion_language} языке.`;
        const fullPrompt = `${systemPrompt}\n\nЗапрос пользователя: ${prompt}`;

        let driver;
        try {
            // 1. Настройка драйвера
            driver = await this.setupDriver();

            // 2. Переход на сайт
            await driver.get('https://chat-ai.one/#chat');

            // 3. Ожидание и поиск поля ввода
            await driver.wait(until.elementLocated(By.id('user-input')), 15000);
            const inputField = await driver.findElement(By.id('user-input'));
            const messagesContainer = await driver.findElement(By.id('chat-messages'));

            // 4. Подсчет начального количества сообщений для отслеживания нового
            const initialMessages = await messagesContainer.findElements(By.css('div'));
            const initialMessageCount = initialMessages.length;

            // 5. Отправка промпта и нажатие Enter
            await inputField.sendKeys(fullPrompt, Key.RETURN);

            // 6. Ожидание появления ответного сообщения
            await driver.wait(async () => {
                const currentMessages = await messagesContainer.findElements(By.css('div'));
                return currentMessages.length > initialMessageCount + 1; // Ждем сообщение пользователя И ответ бота
            }, 30000); // 30-секундный таймаут

            // 7. Получение текста последнего сообщения
            const allMessages = await messagesContainer.findElements(By.css('div'));
            const lastMessage = allMessages[allMessages.length - 1];
            const content = await lastMessage.getText();

            if (!content || content.trim().length < 1) {
                throw new Error("Сайт вернул пустой ответ.");
            }
            return content.trim();

        } catch (error) {
            console.error(`Ошибка взаимодействия через Selenium для "${network.name}": ${error.message}`);
            if (sendMessageCallback) {
                await sendMessageCallback(`_(${network.name}: Произошла ошибка при доступе к сайту. Он может быть недоступен или медленно работать.)_`);
            }
            throw new Error(`Не удалось получить ответ от "${network.name}" через веб-сайт.`);
        } finally {
            // 8. Всегда закрываем браузер для освобождения ресурсов
            if (driver) {
                await driver.quit();
            }
        }
    }
}

class NeuralCollaborativeFramework {
    constructor(sendMessageCallback) {
        this.sendMessage = sendMessageCallback;
        this.networkManager = new NetworkManager();
        this.initializeSettings();
        this.resetProject();
    }
    
    initializeSettings() {
        this.settings = {
            // Настройка 'model' удалена.
            temperature: 0.7, // Настройка больше не используется, но сохранена для структуры.
            max_tokens: 1500, // Настройка больше не используется.
            discussion_language: 'Russian',
            iteration_count: 2,
            enabled_networks: ['network1', 'network2'],
            custom_networks: {},
            system_prompts: {
                network1: 'Ты — Аналитическая Сеть. Фокусируйся на логике, данных и структурных рассуждениях.',
                network2: 'Ты — Креативная Сеть. Фокусируйся на новых идеях, альтернативах и инновационных перспективах.',
                network3: 'Ты — Сеть Реализации. Фокусируйся на практическом применении и технической осуществимости.',
                network4: 'Ты — Сеть Data Science. Фокусируйся на статистике, паттернах и эмпирических данных.',
                network5: 'Ты — Этическая Сеть. Фокусируйся на моральных последствиях и социальном влиянии.',
                network6: 'Ты — Сеть UX. Фокусируйся на пользовательском опыте и удобстве использования.',
                network7: 'Ты — Сеть Системного Мышления. Фокусируйся на целостном видении и взаимосвязях.',
                network8: 'Ты — Сеть "Адвокат Дьявола". Твоя роль — бросать вызов предположениям и проверять идеи на прочность.',
                summarizer: 'Ты — Сеть-Синтезатор. Твоя роль — прочитать дискуссию и составить краткое, нейтральное резюме ключевых моментов.'
            }
        };
    }
    
    resetProject() {
        this.iterations = 0;
        this.acceptedSummaries = [];
        this.isWorking = false;
        this.projectDescription = "";
    }

    async startCollaboration(topic) {
        if (this.isWorking) return this.sendMessage("Обсуждение уже идет. Используйте /stop.");
        if (this.settings.enabled_networks.length < 1) return this.sendMessage("❗️*Ошибка:* Включите хотя бы одну нейросеть.");
        this.resetProject();
        this.isWorking = true;
        this.projectDescription = topic;
        await this.sendMessage(`*Начинаю коллаборацию на тему:* "${topic}"\n\n_Чтобы остановить, используйте команду /stop_`);
        try {
            await this.runDiscussionLoop();
            if (this.isWorking) await this.finalizeDevelopment();
        } catch (error) {
            console.error(error);
            await this.sendMessage(`❗️*Произошла критическая ошибка:* ${error.message}`);
        } finally {
            this.isWorking = false;
        }
    }
    
    async runDiscussionLoop() {
        while (this.iterations < this.settings.iteration_count) {
            if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
            this.iterations++;
            await this.sendMessage(`\n\n--- 💬 *Итерация ${this.iterations} из ${this.settings.iteration_count}* ---\n`);
            let iterationHistory = "";
            for (const networkId of this.settings.enabled_networks) {
                if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
                const networkName = this.networkManager.networks[networkId]?.name || this.settings.custom_networks[networkId]?.name;
                let prompt = `Главная тема: "${this.projectDescription}"\n\n`;
                if (this.acceptedSummaries.length > 0) {
                    prompt += `Вот принятые резюме из предыдущих раундов:\n${this.acceptedSummaries.map((s, i) => `Резюме ${i+1}: ${s}`).join('\n\n')}\n\n`;
                }
                prompt += `Вот ход обсуждения в текущем раунде:\n${iterationHistory}\n\n---\nКак ${networkName}, выскажи свою точку зрения.`;
                await this.sendMessage(`🤔 _${networkName} думает (через веб-сайт)..._`);
                const response = await this.networkManager.generateResponse(networkId, prompt, this.settings, this.sendMessage);
                if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
                await this.sendMessage(`*${networkName}:*\n${response}`);
                iterationHistory += `\n\n**${networkName} сказал(а):**\n${response}`;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
            await this.sendMessage(`📝 _Синтезатор анализирует..._`);
            const summaryPrompt = `Создай краткое резюме из обсуждения:\n\n${iterationHistory}`;
            const summary = await this.networkManager.generateResponse('summarizer', summaryPrompt, this.settings, this.sendMessage);
            if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
            await this.sendMessage(`*Сводка итерации ${this.iterations}:*\n${summary}`);
            
            await this.sendMessage(`🗳️ _Проводим голосование по сводке..._`);
            let votesFor = 0;
            let votesAgainst = 0;
            const keywords = VOTE_KEYWORDS[this.settings.discussion_language] || VOTE_KEYWORDS['Russian'];
            const acceptRegex = new RegExp(`^${keywords.accept}`, 'i');
            for (const networkId of this.settings.enabled_networks) {
                if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
                const networkName = this.networkManager.networks[networkId]?.name || this.settings.custom_networks[networkId]?.name;
                const votePrompt = `Вот резюме для голосования:\n"${summary}"\n\nКак ${networkName}, принимаешь ли ты это резюме? Ответь ТОЛЬКО словом "${keywords.accept}" или "${keywords.reject}" на ${this.settings.discussion_language} языке, а затем кратко объясни причину.`;
                const voteResponse = await this.networkManager.generateResponse(networkId, votePrompt, this.settings, this.sendMessage);
                if (!this.isWorking) { await this.sendMessage("Обсуждение прервано пользователем."); return; }
                await this.sendMessage(`*${networkName} голосует:*\n${voteResponse}`);
                if (acceptRegex.test(voteResponse)) votesFor++; else votesAgainst++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            if (votesAgainst >= votesFor) {
                await this.sendMessage(`*Голосование провалено* (${votesFor} за, ${votesAgainst} против). Сводка отклонена.`);
            } else {
                await this.sendMessage(`*Голосование успешно!* (${votesFor} за, ${votesAgainst} против). Сводка принята.`);
                this.acceptedSummaries.push(summary);
            }
        }
    }

    async finalizeDevelopment() {
        if (this.acceptedSummaries.length === 0) {
            await this.sendMessage("\n\n--- 🏁 *Обсуждение завершено без принятых сводок.* ---");
            return;
        }
        await this.sendMessage("\n\n--- 🏁 *Все итерации завершены. Формирую итоговый отчет...* ---");
        const finalPrompt = `На основе темы "${this.projectDescription}" и резюме, создай итоговый отчет.\n\nРезюме:\n${this.acceptedSummaries.join('\n\n')}`;
        const finalOutput = await this.networkManager.generateResponse('summarizer', finalPrompt, this.settings, this.sendMessage);
        await this.sendMessage(`*Итоговый результат коллаборации:*\n\n${finalOutput}`);
    }
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const chatSessions = {};
const activeRequests = {};

bot.setMyCommands([
    { command: '/start', description: '🚀 Помощь и запуск' },
    { command: '/run', description: '✍️ Новое обсуждение (текстом)' },
    { command: '/stop', description: '🛑 Остановить' },
    { command: '/settings', description: '⚙️ Настройки в чате' },
    { command: '/reset', description: '🗑 Сброс' },
]);

async function sendLongMessage(chatId, text) {
    const maxLength = 4096;
    if (text.length <= maxLength) {
        return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(chatId, text));
    }
    const chunks = text.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) || [];
    for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(chatId, chunk));
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function getOrCreateSession(chatId) {
    if (!chatSessions[chatId]) {
        chatSessions[chatId] = new NeuralCollaborativeFramework((text) => sendLongMessage(chatId, text));
    }
    return chatSessions[chatId];
}

const MAIN_KEYBOARD = { reply_markup: { keyboard: [[{ text: '✍️ Новое Обсуждение' }, { text: '⚙️ Настройки' }]], resize_keyboard: true } };

bot.onText(/\/start/, (msg) => {
    const welcomeText = `
*Добро пожаловать в Neural Collaborative Framework!*

Этот бот теперь использует веб-сайт chat-ai.one для генерации ответов.

*Как начать (через кнопки):*
1. Нажмите "✍️ Новое Обсуждение".
2. Отправьте боту тему для обсуждения.
3. При необходимости, зайдите в "⚙️ Настройки" для выбора участников и т.д.

*Команды:*
/start - Показать это сообщение.
/run - Начать новое обсуждение.
/settings - Открыть меню настроек.
/stop - Принудительно остановить текущую коллаборацию.
/reset - Сбросить все настройки для этого чата.
    `;
    bot.sendMessage(msg.chat.id, welcomeText, { ...MAIN_KEYBOARD, parse_mode: 'Markdown' });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text && text.startsWith('/')) return;
    if (activeRequests[chatId]) {
        handleActiveRequest(chatId, msg);
        return;
    }
    if (text === '✍️ Новое Обсуждение') {
        bot.sendMessage(chatId, 'Какую тему вы хотите обсудить?');
        activeRequests[chatId] = { type: 'topic' };
    } else if (text === '⚙️ Настройки') {
        sendSettingsMessage(chatId);
    }
});

bot.onText(/\/run/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Какую тему вы хотите обсудить?');
    activeRequests[msg.chat.id] = { type: 'topic' };
});
bot.onText(/\/settings/, (msg) => sendSettingsMessage(msg.chat.id));
bot.onText(/\/reset/, (msg) => {
    delete chatSessions[msg.chat.id];
    delete activeRequests[msg.chat.id];
    bot.sendMessage(msg.chat.id, "Обсуждение и настройки сброшены.", MAIN_KEYBOARD);
});
bot.onText(/\/stop/, (msg) => {
    const session = chatSessions[msg.chat.id];
    if (session && session.isWorking) {
        session.isWorking = false;
        bot.sendMessage(msg.chat.id, "🛑 Получен сигнал остановки...");
    } else {
        bot.sendMessage(msg.chat.id, "Сейчас нет активного обсуждения.");
    }
});

// --- Обработчики колбэков (адаптированные) ---
const callbackQueryHandlers = {
    toggle: (session, value, chatId, messageId) => {
        const enabled = session.settings.enabled_networks;
        const index = enabled.indexOf(value);
        if (index > -1) enabled.splice(index, 1);
        else enabled.push(value);
        updateToggleMenu(chatId, messageId, session);
    },
    order: (session, value, chatId, messageId) => {
        const [direction, indexStr] = value.split('_');
        const index = parseInt(indexStr, 10);
        const order = session.settings.enabled_networks;
        if (direction === 'up' && index > 0) [order[index], order[index - 1]] = [order[index - 1], order[index]];
        else if (direction === 'down' && index < order.length - 1) [order[index], order[index + 1]] = [order[index + 1], order[index]];
        else if (direction === 'add') order.splice(index + 1, 0, order[index]);
        else if (direction === 'remove' && order.length > 0) order.splice(index, 1);
        updateOrderMenu(chatId, messageId, session);
    },
    setlang: (session, value, chatId, messageId) => {
        session.settings.discussion_language = value;
        updateLangMenu(chatId, messageId, session);
    },
    setiterations: (session, value, chatId, messageId) => {
        session.settings.iteration_count = parseInt(value, 10);
        updateAdvancedMenu(chatId, messageId, session);
    },
    promptfor: (session, value, chatId, messageId) => {
        const networkName = session.networkManager.networks[value]?.name || session.settings.custom_networks[value]?.name;
        bot.sendMessage(chatId, `Пришлите новый системный промпт для "${networkName}":`);
        activeRequests[chatId] = { type: 'system_prompt', networkId: value };
        bot.deleteMessage(chatId, messageId).catch(()=>{});
    },
    menu: (session, value, chatId, messageId) => {
        const menuActions = {
            'toggle': updateToggleMenu, 'order': updateOrderMenu,
            'lang': updateLangMenu, 'advanced': updateAdvancedMenu, 'prompts': updatePromptsMenu,
            'custom': updateCustomNetworksMenu,
            'createnew': (chatId, messageId, session) => {
                bot.sendMessage(chatId, "Введите имя для новой нейросети:");
                activeRequests[chatId] = { type: 'custom_network_name' };
                bot.deleteMessage(chatId, messageId).catch(()=>{});
            }
        };
        if (menuActions[value]) menuActions[value](chatId, messageId, session);
    },
    back: (session, value, chatId, messageId) => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        if (value === 'settings') sendSettingsMessage(chatId);
        if (value === 'advanced') updateAdvancedMenu(chatId, messageId, session);
    },
    close: (session, value, chatId, messageId) => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
    }
};

bot.on('callback_query', (query) => {
    const { message, data } = query;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const session = getOrCreateSession(chatId);
    bot.answerCallbackQuery(query.id);
    const [action, ...valueParts] = data.split('_');
    const value = valueParts.join('_');
    if (callbackQueryHandlers[action]) {
        callbackQueryHandlers[action](session, value, chatId, messageId);
    }
});

// --- Функции обновления UI (адаптированные) ---
function sendSettingsMessage(chatId) {
    const session = getOrCreateSession(chatId);
    const s = session.settings;
    const settingsText = `*Текущие настройки:*\n\n*Участники:* ${s.enabled_networks.length} реплик\n*Язык:* \`${s.discussion_language}\``;
    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🕹 Участники', callback_data: 'menu_toggle' }, { text: '🔀 Порядок и Реплики', callback_data: 'menu_order' }],
                [{ text: '🌍 Язык', callback_data: 'menu_lang' }, { text: '🧠 Мои Нейросети', callback_data: 'menu_custom' }],
                [{ text: '🔧 Продвинутые настройки', callback_data: 'menu_advanced' }],
                [{ text: '❌ Закрыть', callback_data: 'close_settings' }]
            ]
        }
    };
    bot.sendMessage(chatId, settingsText, { ...inlineKeyboard, parse_mode: 'Markdown' });
}

function updateToggleMenu(chatId, messageId, session) {
    const { enabled_networks, custom_networks } = session.settings;
    const { networks } = session.networkManager;
    const standardButtons = Object.entries(networks).filter(([id]) => id !== 'summarizer').map(([id, net]) => {
        const isEnabled = enabled_networks.includes(id);
        return { text: `${isEnabled ? '✅' : '❌'} ${net.name}`, callback_data: `toggle_${id}` };
    });
    const customButtons = Object.entries(custom_networks).map(([id, net]) => {
        const isEnabled = enabled_networks.includes(id);
        return { text: `${isEnabled ? '✅' : '❌'} ${net.name} (моя)`, callback_data: `toggle_${id}` };
    });
    const allButtons = [...standardButtons, ...customButtons];
    const keyboard = [];
    for (let i = 0; i < allButtons.length; i += 2) keyboard.push(allButtons.slice(i, i + 2));
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_settings' }]);
    bot.editMessageText('*Включите или выключите участников:*', {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
}

function updateOrderMenu(chatId, messageId, session) {
    const { enabled_networks, custom_networks } = session.settings;
    const { networks } = session.networkManager;
    if (enabled_networks.length < 1) {
        bot.editMessageText('*Нет включенных участников для сортировки.*', {
             chat_id: chatId, message_id: messageId, parse_mode: 'Markdown',
             reply_markup: { inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_settings' }]] }
        }).catch(()=>{});
        return;
    }
    const keyboard = enabled_networks.map((networkId, index) => {
        const networkName = networks[networkId]?.name || custom_networks[networkId]?.name;
        const upArrow = (index > 0) ? { text: '🔼', callback_data: `order_up_${index}` } : { text: ' ', callback_data: 'no_op' };
        const downArrow = (index < enabled_networks.length - 1) ? { text: '🔽', callback_data: `order_down_${index}` } : { text: ' ', callback_data: 'no_op' };
        return [{ text: networkName, callback_data: 'no_op' }, upArrow, downArrow, { text: '➕', callback_data: `order_add_${index}` }, { text: '➖', callback_data: `order_remove_${index}` }];
    });
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_settings' }]);
    bot.editMessageText(`*Измените порядок и количество реплик:*`, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
}

function updateLangMenu(chatId, messageId, session) {
    const languages = ['Russian', 'English', 'German', 'French', 'Ukrainian'];
    const keyboard = languages.map(lang => ([{ text: `${lang === session.settings.discussion_language ? '🔘' : '⚪️'} ${lang}`, callback_data: `setlang_${lang}` }]));
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_settings' }]);
    bot.editMessageText('*Выберите язык общения:*', {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
}

function updateAdvancedMenu(chatId, messageId, session) {
    const s = session.settings;
    const text = `*Продвинутые настройки:*\n\n- *Итерации:* \`${s.iteration_count}\``;
    const iterationButtons = [1, 2, 3, 4, 5].map(i => ({
        text: `${s.iteration_count === i ? '🔘' : '⚪️'} ${i}`, callback_data: `setiterations_${i}`
    }));
    const keyboard = [
        iterationButtons,
        [{ text: '🎭 Личности сетей', callback_data: 'menu_prompts' }],
        [{ text: '⬅️ Назад', callback_data: 'back_settings' }]
    ];
    bot.editMessageText(text, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
}

function updatePromptsMenu(chatId, messageId, session) {
    const allNetworks = { ...session.networkManager.networks, ...session.settings.custom_networks };
    const buttons = Object.entries(allNetworks).map(([id, net]) => ([{ text: net.name, callback_data: `promptfor_${id}` }]));
    buttons.push([{ text: '⬅️ Назад', callback_data: 'back_advanced' }]);
    bot.editMessageText('*Выберите нейросеть для изменения ее личности:*', {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons }
    }).catch(() => {});
}

function updateCustomNetworksMenu(chatId, messageId, session) {
    const { custom_networks } = session.settings;
    const text = Object.keys(custom_networks).length > 0 ? '*Ваши кастомные нейросети:*' : '*У вас нет кастомных нейросетей.*';
    const keyboard = Object.entries(custom_networks).map(([id, net]) => ([
        { text: net.name, callback_data: `editcustom_${id}` },
        { text: '🗑', callback_data: `deletecustom_${id}` }
    ]));
    keyboard.push([{ text: '➕ Создать новую', callback_data: 'menu_createnew' }]);
    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_settings' }]);
    bot.editMessageText(text, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {});
}

// --- Обработчики активных запросов (адаптированные) ---
const activeRequestHandlers = {
    'topic': (session, text, chatId) => {
        if (!text || text.trim().length < 5) {
            bot.sendMessage(chatId, '❌ Тема слишком короткая.');
            activeRequests[chatId] = { type: 'topic' };
            return;
        }
        session.startCollaboration(text.trim());
    },
    'system_prompt': (session, text, chatId, request) => {
        session.settings.system_prompts[request.networkId] = text;
        const networkName = session.networkManager.networks[request.networkId]?.name || session.settings.custom_networks[request.networkId]?.name;
        bot.sendMessage(chatId, `✅ Системный промпт для "${networkName}" обновлен.`);
        sendSettingsMessage(chatId);
    },
    'custom_network_name': (session, text, chatId) => {
        const newId = `custom${Date.now()}`;
        activeRequests[chatId] = { type: 'custom_network_prompt', id: newId, name: text.trim() };
        bot.sendMessage(chatId, `Отлично! Теперь введите системный промпт для "${text.trim()}":`);
    },
    'custom_network_prompt': (session, text, chatId, request) => {
        session.settings.custom_networks[request.id] = {
            name: request.name,
            system_prompt: text
        };
        if (!session.settings.enabled_networks.includes(request.id)) {
            session.settings.enabled_networks.push(request.id);
        }
        bot.sendMessage(chatId, `✅ Новая нейросеть "${request.name}" создана!`);
        delete activeRequests[chatId];
        sendSettingsMessage(chatId);
    }
};

function handleActiveRequest(chatId, msg) {
    const request = activeRequests[chatId];
    if (!request) return;
    const session = getOrCreateSession(chatId);
    const text = msg.text;
    if (!text) {
        bot.sendMessage(chatId, "Пожалуйста, ответьте текстом.");
        return;
    }
    const handler = activeRequestHandlers[request.type];
    if (handler) {
        delete activeRequests[chatId];
        handler(session, text, chatId, request);
    }
}

bot.on('polling_error', (error) => {
    console.error(`Ошибка Polling: [${error.code}] ${error.message}`);
});

// --- Express-сервер для Health Checks ---
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.get('/', (req, res) => res.send('Бот жив и здоров!'));
app.listen(PORT, HOST, () => {
    console.log(`Веб-сервер для health check УСПЕШНО запущен и слушает ${HOST}:${PORT}`);
});
