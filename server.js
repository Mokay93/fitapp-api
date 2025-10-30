const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

// Разрешаем запросы с любого источника (важно для связки с Android)
app.use(cors());

// Читаем и парсим файл с упражнениями при запуске
let exercises = [];
try {
    const data = fs.readFileSync('./exercises.json', 'utf8');
    exercises = JSON.parse(data);
    console.log(`Successfully loaded ${exercises.length} exercises.`);
} catch (err) {
    console.error("Error reading or parsing exercises.json:", err);
    // Если файл не найден, сервер все равно запустится, но будет отдавать пустые массивы
}

// --- API Эндпоинты ---

// 1. Получить список всех упражнений (с пагинацией)
// Пример запроса: /exercises?page=1&limit=20
app.get('/exercises', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
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
// Пример запроса: /exercises/bodypart/chest
app.get('/exercises/bodypart/:part', (req, res) => {
    const part = req.params.part.toLowerCase();
    const results = exercises.filter(ex => ex.bodyPart.toLowerCase() === part);
    res.json(results);
});

// --- Запуск сервера ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
});