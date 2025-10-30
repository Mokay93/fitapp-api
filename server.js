    const express = require('express');
    const cors = require('cors');
    const fs = require('fs');

    const app = express();
    const port = 3000;

    app.use(cors());

    let exercises = [];
    try {
        const data = fs.readFileSync('./exercises.json', 'utf8');
        exercises = JSON.parse(data);
        console.log(`Successfully loaded ${exercises.length} exercises.`);
    } catch (err) {
        console.error("Error reading or parsing exercises.json:", err);
    }

    // --- ЭНДПОИНТ ДЛЯ ПРОВЕРКИ ---
    // Теперь на главной странице будет это сообщение
    app.get('/', (req, res) => {
        res.send('Server is running! You can now access /exercises and /bodyparts');
    });

    // 1. Получить список всех упражнений
    app.get('/exercises', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const results = exercises.slice(startIndex, endIndex);
        res.json(results);
    });

    // 2. Получить список всех групп мышц
    app.get('/bodyparts', (req, res) => {
        const bodyParts = [...new Set(exercises.map(ex => ex.bodyPart))];
        res.json(bodyParts);
    });

    // 3. Получить упражнения для конкретной группы мышц
    app.get('/exercises/bodypart/:part', (req, res) => {
        const part = req.params.part.toLowerCase();
        const results = exercises.filter(ex => ex.bodyPart.toLowerCase() === part);
        res.json(results);
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`Server listening on http://0.0.0.0:${port}`);
    });
    
