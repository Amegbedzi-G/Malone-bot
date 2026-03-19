const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const TOKEN = process.env.BOT_TOKEN;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

if (!TOKEN || !REMOVE_BG_API_KEY) {
    console.error('Missing BOT_TOKEN or REMOVE_BG_API_KEY environment variables. Set them before running.');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on('photo', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const photo = msg.photo[msg.photo.length - 1];

        // Get file link
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

        const inputPath = 'input.jpg';
        const outputPath = 'output.png';

        // Download image
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(inputPath);
        response.data.pipe(writer);

        writer.on('finish', async () => {

            // Send to remove.bg
            const formData = new FormData();
            formData.append('image_file', fs.createReadStream(inputPath));
            formData.append('format', 'png');

            const removeBgResponse = await axios.post(
                'https://api.remove.bg/v1.0/removebg',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'X-Api-Key': REMOVE_BG_API_KEY
                    },
                    responseType: 'arraybuffer'
                }
            );

            fs.writeFileSync(outputPath, removeBgResponse.data);

            // Send back result as a document so PNG transparency is preserved
            bot.sendDocument(chatId, outputPath);
        });

    } catch (error) {
        console.error(error);
        bot.sendMessage(msg.chat.id, "Error processing image 😢");
    }
});