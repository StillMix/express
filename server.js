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

    db.run(
        `CREATE TABLE IF NOT EXISTS users (
        userID INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL
        )`, (err) => {
            if(err) {
                console.log(err)
            } else {
                console.log('Таблица users создана')
            }
        }
    );
    db.get(`SELECT * FROM users WHERE name = ?`, ['admin'], (err, row) => {
        if(err){
            console.log(err)
        }
        if(!row){
                    db.run(`INSERT INTO users (name, role, password) VALUES (?, ?,  ?)`, ['admin', 'admin', 'admin'], (err) => {
        if(err) {
            console.log(err)
        } else {
           console.log('Пользователь создан')
        }
    })
        }else{
            console.log('пользователь был создан')
        }
    })


}

app.post('/user', (req, res) => {
  const user = req.body;
  if (!user.name || !user.password){ 
    res.status(400).json({
        message: 'имя и пароль должны быть заполнены'
    })
  }
  else {
    db.run(`INSERT INTO users (name,role, password) VALUES (?,?, ?)`, [user.name, 'user', user.password], (err) => {
        if(err) {
            console.log(err) // Для отладки
            res.status(500).json({ error: 'Ошибка базы данных' })
        } else {
            res.status(201).json({ message: 'Пользователь создан' })
        }
    })
  }
})
app.get('/user/all', (req, res) => {
        db.all(`SELECT * FROM users`, (err, row) => {
            if(err) {
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            } else if(!row) {
                res.status(404).json({ error: 'Пользователь не найден' })
            } else {
                res.status(200).json(row)
            }
        })
    
})
app.get('/user/:id', (req, res) => {
    const id = req.params.id; 
    
    if(!id) {
        res.status(400).json({ error: 'ID не указан' })
    } else {
        db.get(`SELECT * FROM users WHERE userID = ?`, [id], (err, row) => {
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



app.post('/signin', (req, res) => {
    const user = req.body;
    if(!user.name || !user.password){
        res.status(400).json({
          message: "Не хватает логина или пароля"
        })
    }else{
        db.get(`SELECT * FROM users WHERE name = (?) AND password = (?)`, [user.name, user.password], (err, row) => {
            if(err) {
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            } else if(!row) {
                res.status(404).json({ error: 'Вы ввели не верный логин или пароль' })
            } else {
                res.status(200).json(row)
            }
        })
    }
})

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`)
})
