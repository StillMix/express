const express = require('express');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();

app.use(express.json());
const PORT = 3000;

dbPath = path.join(__dirname, 'mydb.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if(err){
        console.log(err)
    } else{
        console.log('ok')
        initDB()
    }
})

function initDB() {
    // Создаем таблицу users с дополнительными полями
    db.run(
        `CREATE TABLE IF NOT EXISTS users (
        userID INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        password TEXT NOT NULL,
        isBlocked INTEGER DEFAULT 0,
        failedAttempts INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLoginAttempt DATETIME
        )`, (err) => {
            if(err) {
                console.log(err)
            } else {
                console.log('Таблица users создана')
            }
        }
    );

    // Проверяем и создаем админа
    db.get(`SELECT * FROM users WHERE name = ?`, ['admin'], (err, row) => {
        if(err){
            console.log(err)
        }
        if(!row){
            db.run(`INSERT INTO users (name, role, password) VALUES (?, ?, ?)`, ['admin', 'admin', 'admin'], (err) => {
                if(err) {
                    console.log(err)
                } else {
                   console.log('Пользователь admin создан')
                }
            })
        } else {
            console.log('Пользователь admin уже существует')
        }
    })
}

// Функция для очистки старых аккаунтов
function cleanOldAccounts() {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    db.run(`DELETE FROM users WHERE role != 'admin' AND createdAt < ?`, [oneMonthAgo.toISOString()], function(err) {
        if(err) {
            console.log('Ошибка при удалении старых аккаунтов:', err)
        } else if(this.changes > 0) {
            console.log(`Удалено ${this.changes} старых аккаунтов`)
        }
    });
}

// Запускаем очистку старых аккаунтов каждые 24 часа (86400000 миллисекунд)
setInterval(cleanOldAccounts, 24 * 60 * 60 * 1000);
// Первая очистка через час после запуска сервера
setTimeout(cleanOldAccounts, 60 * 60 * 1000);

// Создание пользователя
app.post('/user', (req, res) => {
    const user = req.body;
    if (!user.name || !user.password){ 
        res.status(400).json({
            message: 'Имя и пароль должны быть заполнены'
        })
    } else {
        db.run(`INSERT INTO users (name, role, password) VALUES (?, ?, ?)`, [user.name, 'user', user.password], (err) => {
            if(err) {
                if(err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    res.status(409).json({ error: 'Пользователь с таким именем уже существует' })
                } else {
                    console.log(err)
                    res.status(500).json({ error: 'Ошибка базы данных' })
                }
            } else {
                res.status(201).json({ message: 'Пользователь создан' })
            }
        })
    }
})

// Получение всех пользователей
app.get('/user/all', (req, res) => {
    db.all(`SELECT userID, name, role, isBlocked, failedAttempts, createdAt FROM users`, (err, rows) => {
        if(err) {
            console.log(err)
            res.status(500).json({ error: 'Ошибка базы данных' })
        } else {
            res.status(200).json(rows)
        }
    })
})

// Получение пользователя по ID
app.get('/user/:id', (req, res) => {
    const id = req.params.id; 
    
    if(!id) {
        res.status(400).json({ error: 'ID не указан' })
    } else {
        db.get(`SELECT userID, name, role, isBlocked, failedAttempts, createdAt FROM users WHERE userID = ?`, [id], (err, row) => {
            if(err) {
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            } else if(!row) {
                res.status(404).json({ error: 'Пользователь не найден' })
            } else {
                res.status(200).json(row)
            }
        })
    }
})

// Удаление пользователя (только админ может удалять)
app.delete('/user/:id', (req, res) => {
    const { id } = req.params;
    const { adminName, adminPassword } = req.body;

    if (!adminName || !adminPassword) {
        return res.status(400).json({ error: 'Требуются данные администратора' });
    }

    // Проверяем права администратора
    db.get(`SELECT * FROM users WHERE name = ? AND password = ? AND role = 'admin'`, [adminName, adminPassword], (err, admin) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        if (!admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Проверяем, что не удаляем админа
        db.get(`SELECT role FROM users WHERE userID = ?`, [id], (err, user) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            if (user.role === 'admin') {
                return res.status(403).json({ error: 'Нельзя удалить администратора' });
            }

            // Удаляем пользователя
            db.run(`DELETE FROM users WHERE userID = ?`, [id], function(err) {
                if (err) {
                    console.log(err);
                    res.status(500).json({ error: 'Ошибка при удалении' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Пользователь не найден' });
                } else {
                    res.status(200).json({ message: 'Пользователь удален' });
                }
            });
        });
    });
});

// Изменение пароля
app.put('/user/:id/password', (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Требуется текущий и новый пароль' });
    }

    // Проверяем текущий пароль
    db.get(`SELECT * FROM users WHERE userID = ? AND password = ?`, [id, currentPassword], (err, user) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Неверный текущий пароль' });
        }

        // Обновляем пароль
        db.run(`UPDATE users SET password = ? WHERE userID = ?`, [newPassword, id], function(err) {
            if (err) {
                console.log(err);
                res.status(500).json({ error: 'Ошибка при обновлении пароля' });
            } else {
                res.status(200).json({ message: 'Пароль успешно изменен' });
            }
        });
    });
});

// Блокировка пользователя (только админ)
app.post('/user/:id/block', (req, res) => {
    const { id } = req.params;
    const { adminName, adminPassword } = req.body;

    if (!adminName || !adminPassword) {
        return res.status(400).json({ error: 'Требуются данные администратора' });
    }

    // Проверяем права администратора
    db.get(`SELECT * FROM users WHERE name = ? AND password = ? AND role = 'admin'`, [adminName, adminPassword], (err, admin) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        if (!admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Блокируем пользователя
        db.run(`UPDATE users SET isBlocked = 1 WHERE userID = ? AND role != 'admin'`, [id], function(err) {
            if (err) {
                console.log(err);
                res.status(500).json({ error: 'Ошибка при блокировке' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Пользователь не найден или является администратором' });
            } else {
                res.status(200).json({ message: 'Пользователь заблокирован' });
            }
        });
    });
});

// Разблокировка пользователя (только админ)
app.post('/user/:id/unblock', (req, res) => {
    const { id } = req.params;
    const { adminName, adminPassword } = req.body;

    if (!adminName || !adminPassword) {
        return res.status(400).json({ error: 'Требуются данные администратора' });
    }

    // Проверяем права администратора
    db.get(`SELECT * FROM users WHERE name = ? AND password = ? AND role = 'admin'`, [adminName, adminPassword], (err, admin) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        if (!admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Разблокируем пользователя и сбрасываем счетчик неудачных попыток
        db.run(`UPDATE users SET isBlocked = 0, failedAttempts = 0 WHERE userID = ?`, [id], function(err) {
            if (err) {
                console.log(err);
                res.status(500).json({ error: 'Ошибка при разблокировке' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Пользователь не найден' });
            } else {
                res.status(200).json({ message: 'Пользователь разблокирован' });
            }
        });
    });
});

// Вход в систему с проверкой блокировки и счетчиком неудачных попыток
app.post('/signin', (req, res) => {
    const user = req.body;
    if(!user.name || !user.password){
        return res.status(400).json({
            message: "Не хватает логина или пароля"
        });
    }

    // Сначала проверяем, существует ли пользователь и не заблокирован ли он
    db.get(`SELECT * FROM users WHERE name = ?`, [user.name], (err, userRecord) => {
        if(err) {
            console.log(err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if(!userRecord) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if(userRecord.isBlocked) {
            return res.status(403).json({ error: 'Аккаунт заблокирован. Обратитесь к администратору' });
        }

        // Проверяем пароль
        if(userRecord.password === user.password) {
            // Успешный вход - сбрасываем счетчик неудачных попыток
            db.run(`UPDATE users SET failedAttempts = 0, lastLoginAttempt = CURRENT_TIMESTAMP WHERE userID = ?`, [userRecord.userID], (err) => {
                if(err) {
                    console.log(err);
                }
            });
            
            res.status(200).json({
                userID: userRecord.userID,
                name: userRecord.name,
                role: userRecord.role,
                message: 'Успешный вход'
            });
        } else {
            // Неверный пароль - увеличиваем счетчик
            const newFailedAttempts = userRecord.failedAttempts + 1;
            const shouldBlock = newFailedAttempts >= 3;

            db.run(`UPDATE users SET failedAttempts = ?, isBlocked = ?, lastLoginAttempt = CURRENT_TIMESTAMP WHERE userID = ?`, 
                [newFailedAttempts, shouldBlock ? 1 : 0, userRecord.userID], (err) => {
                if(err) {
                    console.log(err);
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }

                if(shouldBlock) {
                    res.status(403).json({ 
                        error: 'Аккаунт заблокирован после 3 неудачных попыток входа. Обратитесь к администратору' 
                    });
                } else {
                    res.status(401).json({ 
                        error: `Неверный пароль. Осталось попыток: ${3 - newFailedAttempts}` 
                    });
                }
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`)
})