require('dotenv').config();

// Подавляем только конкретные предупреждения
const suppressedWarnings = ['DEP0040']; // punycode и другие
process.on('warning', (warning) => {
  if (!suppressedWarnings.includes(warning.name)) {
    console.warn(warning.name, warning.message);
  }
});

console.log('🚀 Запуск AI Telegram бота...');

const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

// Проверяем переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error('❌ Токены не найдены! Проверьте переменные окружения.');
  process.exit(1);
}

console.log('✅ Токены найдены');

const app = express();
const bot = new Telegraf(BOT_TOKEN, {
  telegram: {
    apiRoot: 'https://api.telegram.org',
    webhookReply: false
  }
});

// Middleware для парсинга JSON
app.use(express.json());

// Приветственное сообщение
bot.start((ctx) => {
    const welcomeMessage = `
🤖 Привет! Меня зовут АИ-помощник!
Я создан разработчиком Алексеем как мини ИИ-помощник на базе Google Gemini AI.

✨ Что я умею:
• Отвечать на вопросы
• Помогать с задачами
• Объяснять сложные темы
• Генерировать идеи
• Писать код
• И многое другое!

Просто напишите мне любой вопрос, и я постараюсь помочь! 😊

Разработчик: @Alexey (Алексей)
`;
    ctx.reply(welcomeMessage);
});

// Команда помощи
bot.help((ctx) => {
    const helpMessage = `
📖 Как использовать бота:
1️⃣ Просто напишите любой вопрос
2️⃣ Я отвечу используя ИИ Google Gemini
3️⃣ Можете задавать follow-up вопросы

🔥 Примеры вопросов:
• "Объясни квантовую физику простыми словами"
• "Как приготовить пасту карбонара?"
• "Напиши код на Python для сортировки массива"
• "Дай совет по изучению программирования"
• "Переведи текст на английский"
• "Помоги решить математическую задачу"

⚡ Бот работает на бесплатном API и доступен всем!

🌐 Статус: ${process.env.NODE_ENV || 'development'}
🚀 Хостинг: Railway
    `;
    ctx.reply(helpMessage);
});

// Команда /status
bot.command('status', (ctx) => {
    const statusMessage = `
📊 Статус бота:
✅ Бот: Активен
✅ Gemini AI: Подключен
⏱ Uptime: ${Math.floor(process.uptime())} сек
💾 Node.js: ${process.version}
🌐 Сервер: Онлайн
🔗 Режим: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}

🤖 Готов к работе!
    `;
    ctx.reply(statusMessage);
});

// Функция для отправки запроса к Gemini API
async function askGemini(question) {
    try {
        console.log('🧠 Отправляем запрос к Gemini AI...');

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: `Ответь на русском языке (если вопрос не требует другого языка). Будь дружелюбным и полезным. Вопрос: ${question}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        if (response.data && response.data.candidates && response.data.candidates[0]) {
            const aiResponse = response.data.candidates[0].content.parts[0].text;
            console.log('✅ Получен ответ от Gemini AI');
            return aiResponse;
        } else {
            console.log('⚠️ Пустой ответ от Gemini API');
            return "Извините, не удалось получить ответ от ИИ. Попробуйте еще раз.";
        }
    } catch (error) {
        console.error('❌ Ошибка при обращении к Gemini API:', error.response?.data || error.message);

        if (error.response?.status === 429) {
            return "⏰ Слишком много запросов. Подождите немного и попробуйте снова.";
        } else if (error.response?.status === 403) {
            return "🔑 Проблема с API ключом. Обратитесь к разработчику.";
        } else if (error.code === 'ECONNABORTED') {
            return "⏱️ Запрос занял слишком много времени. Попробуйте снова.";
        } else {
            return "❌ Произошла ошибка. Попробуйте переформулировать вопрос.";
        }
    }
}

// Обработка всех текстовых сообщений
bot.on('text', async (ctx) => {
    const userMessage = ctx.message.text;
    const userName = ctx.from.first_name || 'Пользователь';

    console.log(`💬 Сообщение от ${userName}: ${userMessage}`);

    // Показываем, что бот печатает
    await ctx.sendChatAction('typing');

    try {
        const aiResponse = await askGemini(userMessage);

        // Ограничиваем длину ответа (Telegram имеет лимит 4096 символов)
        if (aiResponse.length > 4000) {
            const truncatedResponse = aiResponse.substring(0, 4000) + "...\n\n📝 Ответ был сокращен из-за ограничений Telegram.";
            await ctx.reply(truncatedResponse);
        } else {
            await ctx.reply(aiResponse);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        await ctx.reply("😔 Извините, произошла ошибка. Попробуйте еще раз.");
    }
});

// Обработка других типов сообщений
bot.on('sticker', (ctx) => {
    ctx.reply('🎭 Классный стикер! Но я пока умею работать только с текстом. Задайте мне вопрос!');
});

bot.on('photo', (ctx) => {
    ctx.reply('📸 Красивое фото! Но пока я умею работать только с текстом. Опишите что-нибудь словами!');
});

bot.on('voice', (ctx) => {
    ctx.reply('🎤 Извините, я пока не умею обрабатывать голосовые сообщения. Напишите текстом!');
});

bot.on('document', (ctx) => {
    ctx.reply('📄 Интересный документ! Но я работаю только с текстовыми сообщениями. Скопируйте нужный текст!');
});

// Обработка ошибок бота
bot.catch((err, ctx) => {
  // 409 ошибки обрабатываем отдельно
  if (err.code === 409 || (err.description && err.description.includes('Conflict'))) {
    console.log('ℹ️ Конфликт с другим экземпляром бота (игнорируем)');
    return;
  }
  
  console.error('❌ Ошибка бота:', err.message || err);
  
  // Пытаемся ответить пользователю только если контекст доступен
  if (ctx && ctx.reply) {
    try {
      ctx.reply('😔 Произошла ошибка. Попробуйте снова.');
    } catch (replyError) {
      console.error('❌ Не удалось отправить сообщение об ошибке:', replyError.message);
    }
  }
});

// === ВЕБ-СЕРВЕР ===

// Главная страница
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🤖 AI Telegram Bot</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .container {
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 600px;
                width: 90%;
            }

            .status {
                background: #d4edda;
                color: #155724;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border: 2px solid #c3e6cb;
            }

            .ai-info {
                background: #e3f2fd;
                color: #1565c0;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border: 2px solid #bbdefb;
            }

            h1 {
                color: #333;
                margin-bottom: 20px;
                font-size: 2.5em;
            }

            .emoji {
                font-size: 4em;
                margin-bottom: 20px;
            }

            .features {
                text-align: left;
                margin: 20px 0;
            }

            .stats {
                display: flex;
                justify-content: space-around;
                margin-top: 20px;
            }

            .stat {
                text-align: center;
            }

            .stat-number {
                font-size: 1.5em;
                font-weight: bold;
                color: #007bff;
            }

            .telegram-link {
                display: inline-block;
                background: #0088cc;
                color: white;
                padding: 15px 30px;
                border-radius: 10px;
                text-decoration: none;
                margin-top: 20px;
                font-weight: bold;
                transition: background 0.3s;
            }

            .telegram-link:hover {
                background: #006699;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">🤖</div>
            <h1>AI Telegram Bot</h1>

            <div class="status">
                <h3>✅ Бот работает и готов помочь!</h3>
                <p>Сервер запущен на порту ${process.env.PORT || 3000}</p>
                <p>Режим: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}</p>
                <p>Время: ${new Date().toLocaleString('ru-RU')}</p>
            </div>

            <div class="ai-info">
                <h3>🧠 Powered by Google Gemini AI</h3>
                <p>Умный помощник, готовый ответить на любые вопросы</p>
            </div>

            <div class="features">
                <h3>✨ Возможности бота:</h3>
                <ul>
                    <li>🔍 Отвечает на любые вопросы</li>
                    <li>💡 Генерирует идеи и решения</li>
                    <li>📝 Помогает с написанием текстов</li>
                    <li>💻 Объясняет программирование</li>
                    <li>🌍 Переводит на разные языки</li>
                    <li>🧮 Решает математические задачи</li>
                </ul>
            </div>

            <a href="https://t.me/akauntvanish_ai_bot" target="_blank" class="telegram-link">
                📱 Открыть бота в Telegram
            </a>

            <div class="stats">
                <div class="stat">
                    <div class="stat-number">24/7</div>
                    <div>Работает</div>
                </div>
                <div class="stat">
                    <div class="stat-number">🚀</div>
                    <div>Быстро</div>
                </div>
                <div class="stat">
                    <div class="stat-number">🆓</div>
                    <div>Бесплатно</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// API статус
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        bot: 'active',
        ai: 'gemini-connected',
        mode: USE_WEBHOOK ? 'webhook' : 'polling',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// Health check для Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Webhook для Telegram
app.post('/webhook', (req, res) => {
    try {
        bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Ошибка обработки webhook:', error.message);
        res.sendStatus(500);
    }
});

// Функция безопасной остановки бота
async function stopBot() {
    try {
        if (bot) {
            console.log('🛑 Остановка бота...');
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            bot.stop();
            console.log('✅ Бот остановлен');
        }
    } catch (error) {
        console.log('ℹ️ Ошибка при остановке бота (игнорируем):', error.message);
    }
}

// Функция безопасного запуска бота
async function startBot() {
    try {
        console.log('🔄 Настройка бота...');
        
        // Сначала удаляем все webhook'и и обновления
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('🗑️ Webhook удален');
        
        // Небольшая пауза для стабилизации
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (USE_WEBHOOK && WEBHOOK_URL) {
            // Используем webhook режим
            console.log('🪝 Настройка webhook режима...');
            await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
            console.log('✅ Webhook установлен:', `${WEBHOOK_URL}/webhook`);
        } else {
            // Используем polling режим
            console.log('📡 Запуск в polling режиме...');
            await bot.launch({
                polling: {
                    timeout: 30,
                    limit: 100,
                    allowedUpdates: ['message', 'callback_query']
                }
            });
            console.log('✅ Polling режим активен');
        }
        
        console.log('🤖 Telegram бот готов к работе!');
        
    } catch (error) {
        if (error.code === 409 || (error.description && error.description.includes('Conflict'))) {
            console.log('⚠️ Конфликт: другой экземпляр бота уже работает');
            console.log('ℹ️ Попытка работы в ограниченном режиме...');
        } else {
            console.error('❌ Ошибка запуска бота:', error.message);
            // Не прерываем работу сервера из-за ошибки бота
        }
    }
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
let serverInstance = null;

// Сначала запускаем веб-сервер
serverInstance = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
    console.log(`🔗 Режим: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}`);
    
    // Затем запускаем бота с задержкой
    setTimeout(startBot, 3000);
});

// Graceful shutdown с правильной обработкой
const gracefulShutdown = async (signal) => {
    console.log(`🛑 Получен сигнал ${signal}, начинаем остановку...`);
    
    // Останавливаем сервер
    if (serverInstance) {
        serverInstance.close(() => {
            console.log('🌐 Веб-сервер остановлен');
        });
    }
    
    // Останавливаем бота
    await stopBot();
    
    console.log('✅ Приложение корректно остановлено');
    process.exit(0);
};

// Обработка сигналов завершения
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанное исключение:', error.message);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});