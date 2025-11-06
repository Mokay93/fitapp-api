// index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- СЕКРЕТНЫЕ КЛЮЧИ ---
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
        seedTrainingPlans();
    })
    .catch((err) => console.error("MongoDB connection error:", err));

// ===============================================
// --- МОДЕЛИ ДАННЫХ (SCHEMAS) ---
// ===============================================

// --- Модель пользователя ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    stats: {
        totalCalories: { type: Number, default: 0 },
        totalMinutes: { type: Number, default: 0 },
        totalWorkouts: { type: Number, default: 0 },
    },
});
const User = mongoose.model("User", UserSchema);

// --- Модели для планов тренировок ---
const PlanExerciseSchema = new mongoose.Schema(
    {
        exerciseId: { type: String, required: true },
        reps: { type: Number },
        sets: { type: Number },
        duration_seconds: { type: Number },
    },
    { _id: false },
);

const WorkoutDaySchema = new mongoose.Schema(
    {
        dayNumber: { type: Number, required: true },
        exercises: [PlanExerciseSchema],
    },
    { _id: false },
);

const TrainingPlanSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    days: [WorkoutDaySchema],
});
const TrainingPlan = mongoose.model("TrainingPlan", TrainingPlanSchema);

// --- MIDDLEWARE ДЛЯ ПРОВЕРКИ ТОКЕНА ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ message: "Нет токена, в доступе отказано" });
    }
    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (e) {
        res.status(400).json({ message: "Токен недействителен" });
    }
};

// ===============================================
// --- МАРШРУТЫ (РОУТЕРЫ) ---
// ===============================================

// --- Роутер для АВТОРИЗАЦИИ ---
const authRouter = express.Router();

authRouter.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res
            .status(400)
            .json({ message: "Пожалуйста, заполните все поля" });
    }
    if (password.length < 6) {
        return res
            .status(400)
            .json({ message: "Пароль должен быть не менее 6 символов" });
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: "Пользователь с таким email уже существует" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        const token = jwt.sign({ id: newUser._id }, JWT_SECRET, {
            expiresIn: "30d",
        });
        res.status(201).json({ token });
    } catch (error) {
        res.status(500).json({
            message: "Ошибка сервера при регистрации",
            error,
        });
    }
});

authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(400)
                .json({ message: "Неверный логин или пароль" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res
                .status(400)
                .json({ message: "Неверный логин или пароль" });
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET, {
            expiresIn: "30d",
        });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: "Ошибка сервера при входе" });
    }
});

authRouter.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }
        res.json({
            username: user.username,
            email: user.email,
            stats: user.stats,
        });
    } catch (error) {
        res.status(500).json({
            message: "Ошибка сервера при получении профиля",
        });
    }
});

// --- Роутер для ДАННЫХ (упражнения и планы) ---
const dataRouter = express.Router();
let exercises = [];
try {
    const data = fs.readFileSync("./exercises.json", "utf8");
    exercises = JSON.parse(data);
    console.log(`Successfully loaded ${exercises.length} exercises.`);
} catch (err) {
    console.error("Error reading or parsing exercises.json:", err);
}

dataRouter.get("/exercises", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    res.json(exercises.slice((page - 1) * limit, page * limit));
});

dataRouter.get("/bodyparts", (req, res) => {
    const bodyParts = [
        ...new Set(exercises.map((ex) => ex.bodyPart).filter(Boolean)),
    ];
    res.json(bodyParts);
});

// Эндпоинт для получения ВСЕХ планов тренировок
dataRouter.get("/training-plans", async (req, res) => {
    try {
        const plans = await TrainingPlan.find();
        res.json(plans);
    } catch (error) {
        res.status(500).json({
            message: "Ошибка сервера при получении планов тренировок",
        });
    }
});

// ----- > ИСПРАВЛЕНИЕ: ДОБАВЛЕН НОВЫЙ ЭНДПОИНТ < -----
// Эндпоинт для получения ДЕТАЛЕЙ одного плана
dataRouter.get("/training-plans/:id", async (req, res) => {
    try {
        const plan = await TrainingPlan.findOne({ id: req.params.id });
        if (!plan) {
            return res.status(404).json({ message: "План не найден" });
        }
        res.json(plan);
    } catch (error) {
        res.status(500).json({
            message: "Ошибка сервера при получении деталей плана",
        });
    }
});
// ----------------------------------------------------

// --- РЕГИСТРАЦИЯ РОУТЕРОВ В ПРИЛОЖЕНИИ ---
app.use("/api/auth", authRouter);
app.use("/api", dataRouter);

// --- ЗАПУСК СЕРВЕРА ---
app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
    console.log("--- Registered API endpoints ---");
    console.log("POST /api/auth/signup");
    console.log("POST /api/auth/login");
    console.log("GET /api/auth/profile");
    console.log("GET /api/exercises");
    console.log("GET /api/bodyparts");
    console.log("GET /api/training-plans");
    // ----- > ИСПРАВЛЕНИЕ: ДОБАВЛЕН ЛОГ < -----
    console.log("GET /api/training-plans/:id  <-- NEW");
    // ------------------------------------------
    console.log("------------------------------");
});

// --- ФУНКЦИЯ АВТОМАТИЧЕСКОГО ЗАПОЛНЕНИЯ БАЗЫ ПЛАНАМИ ---
// (код без изменений)
async function seedTrainingPlans() {
    try {
        const count = await TrainingPlan.countDocuments();
        if (count > 0) {
            console.log("Training plans already exist. Seeder skipped.");
            return;
        }

        console.log("No training plans found. Seeding database...");

        const plans = [
            {
                id: "quick-abs-start",
                name: "Быстрый старт для пресса",
                description:
                    "Короткая, но интенсивная тренировка, нацеленная на мышцы живота. Идеально для начала.",
                days: [
                    {
                        dayNumber: 1,
                        exercises: [
                            { exerciseId: "3_4_Sit-Up", sets: 3, reps: 15 },
                            {
                                exerciseId: "Ab_Crunch_Machine",
                                sets: 3,
                                reps: 12,
                            },
                            { exerciseId: "Ab_Roller", sets: 3, reps: 10 },
                        ],
                    },
                ],
            },
            {
                id: "post-workout-stretch",
                name: "Растяжка после тренировки",
                description:
                    "Комплекс упражнений на растяжку для восстановления мышц и улучшения гибкости.",
                days: [
                    {
                        dayNumber: 1,
                        exercises: [
                            {
                                exerciseId: "90_90_Hamstring",
                                sets: 2,
                                duration_seconds: 30,
                            },
                            {
                                exerciseId: "Adductor",
                                sets: 2,
                                duration_seconds: 30,
                            },
                            {
                                exerciseId: "Adductor_Groin",
                                sets: 2,
                                duration_seconds: 30,
                            },
                        ],
                    },
                ],
            },
        ];

        await TrainingPlan.insertMany(plans);
        console.log("Successfully seeded 2 training plans.");
    } catch (error) {
        console.error("Error seeding training plans:", error);
    }
}
